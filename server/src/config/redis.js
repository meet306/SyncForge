import Redis from 'ioredis';
import { EventEmitter } from 'events';

class MemoryPubSub extends EventEmitter {
  constructor() {
    super();
    this.channels = new Map();
  }

  async publish(channel, message) {
    this.emit(channel, message);
    return 1;
  }

  async subscribe(channel, callback) {
    this.on(channel, callback);
  }

  async unsubscribe(channel, callback) {
    if (callback) {
      this.off(channel, callback);
    } else {
      this.removeAllListeners(channel);
    }
  }

  async set(key, value, ...args) {
    // Basic in-memory store
    this[key] = value;
    return 'OK';
  }

  async get(key) {
    return this[key] || null;
  }

  async del(key) {
    delete this[key];
    return 1;
  }
}

let pubClient = null;
let subClient = null;
let isRedisAvailable = false;
const inMemoryPubSub = new MemoryPubSub();

export async function initRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  return new Promise((resolve) => {
    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null, // Don't hang indefinitely if Redis isn't running
        connectTimeout: 2000,
        lazyConnect: true
      });

      client.on('error', () => {});

      client.connect()
        .then(() => {
          console.log(`[Redis] Connected to Redis instance at ${redisUrl}`);
          isRedisAvailable = true;
          pubClient = client;
          subClient = new Redis(redisUrl, { lazyConnect: false });
          subClient.on('error', () => {});
          resolve({ pubClient, subClient, isRedisAvailable: true });
        })
        .catch((err) => {
          console.warn(`[Redis Warning] Redis unavailable (${err.message}). Using high-performance in-memory coordination adapter.`);
          isRedisAvailable = false;
          resolve({ pubClient: inMemoryPubSub, subClient: inMemoryPubSub, isRedisAvailable: false });
        });
    } catch (err) {
      console.warn(`[Redis Warning] Failed to initialize Redis (${err.message}). Using in-memory coordination adapter.`);
      isRedisAvailable = false;
      resolve({ pubClient: inMemoryPubSub, subClient: inMemoryPubSub, isRedisAvailable: false });
    }
  });
}

export function getRedisClients() {
  if (!pubClient) {
    return { pubClient: inMemoryPubSub, subClient: inMemoryPubSub, isRedisAvailable: false };
  }
  return { pubClient, subClient, isRedisAvailable };
}

export { inMemoryPubSub };
