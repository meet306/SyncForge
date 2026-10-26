import { WebSocketServer } from 'ws';
import url from 'url';
import { CollaborationRoom } from './room.js';
import { verifyToken } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { Document } from '../models/Document.js';
import { DocumentMember } from '../models/DocumentMember.js';
import { ShareLink } from '../models/ShareLink.js';

class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  getOrCreateRoom(documentId) {
    if (!this.rooms.has(documentId)) {
      const room = new CollaborationRoom(documentId, this);
      this.rooms.set(documentId, room);
    }
    return this.rooms.get(documentId);
  }

  getRoom(documentId) {
    return this.rooms.get(documentId) || null;
  }

  deleteRoom(documentId) {
    this.rooms.delete(documentId);
  }

  getActiveRoomCount() {
    return this.rooms.size;
  }

  getTotalConnectionsCount() {
    let total = 0;
    for (const room of this.rooms.values()) {
      total += room.conns.size;
    }
    return total;
  }

  async flushAll() {
    console.log(`[Collaboration Server] Flushing all ${this.rooms.size} active rooms...`);
    const promises = [];
    for (const room of this.rooms.values()) {
      promises.push(
        (async () => {
          await room.flushPendingUpdates();
          await room.triggerSnapshot();
        })()
      );
    }
    await Promise.all(promises);
    console.log('[Collaboration Server] All active rooms flushed cleanly.');
  }
}

export const roomManager = new RoomManager();

export function setupCollaborationServer(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    try {
      const parsedUrl = url.parse(request.url, true);
      const pathname = parsedUrl.pathname || '';

      // Match /collaboration/:documentId or /ws/:documentId
      const match = pathname.match(/^\/(?:collaboration|ws)\/([a-zA-Z0-9_-]+)/);
      if (!match) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      const documentId = match[1];
      const token = parsedUrl.query.token;
      const shareToken = parsedUrl.query.shareToken;

      let authUser = null;
      let effectiveRole = null;

      // 1. Authenticate via JWT token if provided
      if (token) {
        try {
          const decoded = verifyToken(token);
          const user = await User.findById(decoded.id);
          if (user) {
            authUser = user;
          }
        } catch (err) {
          console.warn('[Collaboration Auth] Invalid JWT token in WebSocket upgrade:', err.message);
        }
      }

      // 2. Check Document existence
      const doc = await Document.findById(documentId);
      if (!doc) {
        socket.write('HTTP/1.1 404 Document Not Found\r\n\r\n');
        socket.destroy();
        return;
      }

      // 3. Resolve role based on ownership, membership, or shareLink
      if (authUser) {
        if (doc.ownerId.toString() === authUser._id.toString()) {
          effectiveRole = 'owner';
        } else {
          const membership = await DocumentMember.findOne({
            documentId: doc._id,
            userId: authUser._id
          });
          if (membership) {
            effectiveRole = membership.role;
          }
        }
      }

      // 4. If not authorized by account, check share token
      if (!effectiveRole && shareToken) {
        const hashedToken = ShareLink.hashToken(shareToken);
        const link = await ShareLink.findOne({
          documentId: doc._id,
          tokenHash: hashedToken,
          isRevoked: false
        });

        if (link && (!link.expiresAt || new Date(link.expiresAt) > new Date())) {
          effectiveRole = link.permission; // 'viewer' or 'editor'
          if (!authUser) {
            authUser = {
              _id: 'guest_' + Math.random().toString(36).substring(2, 9),
              name: 'Guest Collaborator',
              email: 'guest@syncforge.local',
              avatarColor: '#64748b'
            };
          }
        }
      }

      // 5. If still no effective role, reject upgrade
      if (!effectiveRole) {
        console.warn(`[Collaboration Auth] Unauthorized connection attempt to doc ${documentId}`);
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // 6. Complete upgrade
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, {
          user: authUser,
          role: effectiveRole,
          documentId
        });
      });
    } catch (err) {
      console.error('[Collaboration Server] Upgrade error:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws, request, { user, role, documentId }) => {
    console.log(`[Collaboration Server] User ${user.name} (${user.email}) connected to doc ${documentId} as [${role}]`);
    const room = roomManager.getOrCreateRoom(documentId);
    room.handleConnection(ws, user, role);
  });

  return { wss, roomManager };
}
