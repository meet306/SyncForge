import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import {
  loadDocumentFromStorage,
  persistUpdate,
  createDocumentSnapshot
} from './persistence.js';
import { getRedisClients } from '../config/redis.js';

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const MESSAGE_AUTH = 2;
const MESSAGE_QUERY_AWARENESS = 3;

export class CollaborationRoom {
  constructor(documentId, roomManager) {
    this.documentId = documentId;
    this.roomManager = roomManager;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    this.conns = new Map(); // conn -> { user, role, clientIds }
    this.version = 0;
    this.updatesSinceSnapshot = 0;
    this.isLoaded = false;
    this.destroyTimer = null;
    this.flushTimer = null;
    this.pendingUpdates = [];
    this.snapshotThreshold = parseInt(process.env.SNAPSHOT_UPDATE_THRESHOLD || '50', 10);
    this.snapshotIntervalMs = parseInt(process.env.SNAPSHOT_INTERVAL_MS || '60000', 10);
    this.debounceMs = parseInt(process.env.PERSISTENCE_DEBOUNCE_MS || '2000', 10);

    this.init();
  }

  async init() {
    // 1. Load persisted snapshot & incremental updates from MongoDB
    try {
      const storageState = await loadDocumentFromStorage(this.documentId, this.doc);
      this.version = storageState.version || 0;
      this.isLoaded = true;
      console.log(`[Room ${this.documentId}] Initialized with version ${this.version} (${storageState.updateCount} updates applied).`);
    } catch (err) {
      console.error(`[Room ${this.documentId}] Error loading from storage:`, err);
      this.isLoaded = true;
    }

    // 2. Setup Yjs document update listeners
    this.doc.on('update', (update, origin) => {
      // Broadcast update to peers (except the origin connection)
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const [conn] of this.conns) {
        if (conn !== origin && conn.readyState === 1 /* OPEN */) {
          this.sendBinary(conn, message);
        }
      }

      // If update was generated locally (not from Redis subscriber), publish to Redis
      if (origin !== 'redis-pubsub') {
        this.publishUpdateToRedis(update);
        this.queueUpdateForPersistence(update, origin);
      }
    });

    // 3. Setup Awareness update listeners
    this.awareness.on('update', ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated).concat(removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
      );
      const message = encoding.toUint8Array(encoder);

      for (const [conn] of this.conns) {
        if (conn !== origin && conn.readyState === 1 /* OPEN */) {
          this.sendBinary(conn, message);
        }
      }
    });

    // 4. Redis PubSub setup for multi-server synchronization
    this.setupRedisSubscription();
  }

  setupRedisSubscription() {
    const { subClient, isRedisAvailable } = getRedisClients();
    this.redisChannel = `syncforge:doc:${this.documentId}`;

    if (isRedisAvailable && subClient) {
      this.redisMessageHandler = (channel, msg) => {
        if (channel === this.redisChannel) {
          try {
            const parsed = JSON.parse(msg);
            if (parsed.serverId !== process.pid && parsed.update) {
              const binaryUpdate = Buffer.from(parsed.update, 'base64');
              Y.applyUpdate(this.doc, binaryUpdate, 'redis-pubsub');
            }
          } catch (err) {
            console.error(`[Room ${this.documentId}] Redis message parse error:`, err);
          }
        }
      };

      subClient.subscribe(this.redisChannel);
      subClient.on('message', this.redisMessageHandler);
    }
  }

  publishUpdateToRedis(update) {
    const { pubClient, isRedisAvailable } = getRedisClients();
    if (isRedisAvailable && pubClient) {
      try {
        const payload = JSON.stringify({
          serverId: process.pid,
          documentId: this.documentId,
          update: Buffer.from(update).toString('base64'),
          timestamp: Date.now()
        });
        pubClient.publish(this.redisChannel, payload);
      } catch (err) {
        console.warn(`[Room ${this.documentId}] Redis publish failed:`, err.message);
      }
    }
  }

  queueUpdateForPersistence(update, originConn) {
    this.version += 1;
    this.updatesSinceSnapshot += 1;

    const userId = originConn && this.conns.has(originConn)
      ? this.conns.get(originConn).user?._id
      : null;

    this.pendingUpdates.push({
      update: Buffer.from(update),
      sequenceNumber: this.version,
      userId
    });

    // Schedule debounced flush
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushPendingUpdates();
      }, this.debounceMs);
    }

    // Trigger snapshot if threshold reached
    if (this.updatesSinceSnapshot >= this.snapshotThreshold) {
      this.triggerSnapshot();
    }
  }

  async flushPendingUpdates() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUpdates.length === 0) return;

    const batch = [...this.pendingUpdates];
    this.pendingUpdates = [];

    for (const item of batch) {
      try {
        await persistUpdate(
          this.documentId,
          item.update,
          item.sequenceNumber,
          item.userId
        );
      } catch (err) {
        console.error(`[Room ${this.documentId}] Failed to persist update seq ${item.sequenceNumber}:`, err);
      }
    }
  }

  async triggerSnapshot() {
    this.updatesSinceSnapshot = 0;
    try {
      await this.flushPendingUpdates();
      await createDocumentSnapshot(this.documentId, this.doc, this.version);
      console.log(`[Room ${this.documentId}] Compact snapshot created at version ${this.version}`);
    } catch (err) {
      console.error(`[Room ${this.documentId}] Snapshot creation failed:`, err);
    }
  }

  sendBinary(conn, message) {
    if (conn.readyState === 1 /* OPEN */) {
      conn.send(message, (err) => {
        if (err) {
          console.warn(`[Room ${this.documentId}] WebSocket send error:`, err.message);
        }
      });
    }
  }

  handleConnection(conn, user, role) {
    if (this.destroyTimer) {
      clearTimeout(this.destroyTimer);
      this.destroyTimer = null;
    }

    const connData = {
      user,
      role, // 'owner' | 'editor' | 'viewer'
      clientIds: new Set()
    };
    this.conns.set(conn, connData);

    // 1. Send sync step 1 from server to client
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    this.sendBinary(conn, encoding.toUint8Array(encoder));

    // 2. Send current awareness states to client
    const awarenessStates = this.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          this.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      this.sendBinary(conn, encoding.toUint8Array(awarenessEncoder));
    }

    // 3. Message handling
    conn.on('message', (data) => {
      this.handleMessage(conn, new Uint8Array(data));
    });

    // 4. Disconnect handling
    conn.on('close', () => {
      this.handleDisconnection(conn);
    });

    conn.on('error', (err) => {
      console.warn(`[Room ${this.documentId}] Client connection error:`, err.message);
      this.handleDisconnection(conn);
    });
  }

  handleMessage(conn, message) {
    try {
      const connData = this.conns.get(conn);
      if (!connData) return;

      const decoder = decoding.createDecoder(message);
      const messageType = decoding.readVarUint(decoder);

      switch (messageType) {
        case MESSAGE_SYNC: {
          const syncType = decoding.readVarUint(decoder);

          if (syncType === syncProtocol.messageYjsSyncStep1) {
            // Client is requesting missing updates (both editors and viewers can read)
            const replyEncoder = encoding.createEncoder();
            encoding.writeVarUint(replyEncoder, MESSAGE_SYNC);
            syncProtocol.writeSyncStep2(replyEncoder, this.doc, decoding.readVarUint8Array(decoder));
            this.sendBinary(conn, encoding.toUint8Array(replyEncoder));
          } else if (syncType === syncProtocol.messageYjsSyncStep2 || syncType === syncProtocol.messageYjsUpdate) {
            // Client is attempting to modify document
            if (connData.role === 'viewer') {
              console.warn(`[Security Alert] Viewer ${connData.user?.email} attempted unauthorized document edit on ${this.documentId}. Rejected.`);
              return; // Do NOT apply edit
            }

            // Valid editor or owner: apply update
            const update = decoding.readVarUint8Array(decoder);
            Y.applyUpdate(this.doc, update, conn);
          }
          break;
        }

        case MESSAGE_AWARENESS: {
          const update = decoding.readVarUint8Array(decoder);
          awarenessProtocol.applyAwarenessUpdate(this.awareness, update, conn);
          break;
        }

        case MESSAGE_QUERY_AWARENESS: {
          const awarenessEncoder = encoding.createEncoder();
          encoding.writeVarUint(awarenessEncoder, MESSAGE_AWARENESS);
          encoding.writeVarUint8Array(
            awarenessEncoder,
            awarenessProtocol.encodeAwarenessUpdate(
              this.awareness,
              Array.from(this.awareness.getStates().keys())
            )
          );
          this.sendBinary(conn, encoding.toUint8Array(awarenessEncoder));
          break;
        }

        default:
          console.warn(`[Room ${this.documentId}] Unknown message type:`, messageType);
      }
    } catch (err) {
      console.error(`[Room ${this.documentId}] Error processing message:`, err);
    }
  }

  handleDisconnection(conn) {
    const connData = this.conns.get(conn);
    if (!connData) return;

    // Remove awareness states associated with this connection
    if (connData.clientIds && connData.clientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        Array.from(connData.clientIds),
        null
      );
    }

    this.conns.delete(conn);
    console.log(`[Room ${this.documentId}] Client disconnected (${connData.user?.email || 'Anonymous'}). Active conns: ${this.conns.size}`);

    // If room is empty, start grace timer before unloading
    if (this.conns.size === 0) {
      this.destroyTimer = setTimeout(async () => {
        await this.flushPendingUpdates();
        await this.triggerSnapshot();
        this.destroy();
      }, 30000); // 30s grace period
    }
  }

  async destroy() {
    console.log(`[Room ${this.documentId}] Unloading room from memory.`);
    if (this.destroyTimer) clearTimeout(this.destroyTimer);
    if (this.flushTimer) clearTimeout(this.flushTimer);

    // Unsubscribe from Redis
    const { subClient } = getRedisClients();
    if (subClient && this.redisMessageHandler) {
      try {
        subClient.unsubscribe(this.redisChannel);
        subClient.off('message', this.redisMessageHandler);
      } catch (err) {
        // ignore cleanup error
      }
    }

    // Destroy awareness and doc
    this.awareness.destroy();
    this.doc.destroy();
    this.roomManager.deleteRoom(this.documentId);
  }
}
