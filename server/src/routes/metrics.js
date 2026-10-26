import express from 'express';
import mongoose from 'mongoose';
import { getRedisClients } from '../config/redis.js';
import { roomManager } from '../collaboration/server.js';

const router = express.Router();

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
  const { isRedisAvailable } = getRedisClients();

  const isHealthy = dbState === 1;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: dbStatus,
    redis: isRedisAvailable ? 'connected' : 'in-memory-fallback',
    activeRooms: roomManager.getActiveRoomCount(),
    activeConnections: roomManager.getTotalConnectionsCount()
  });
});

router.get('/api/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    timestamp: new Date().toISOString(),
    process: {
      pid: process.pid,
      uptimeSeconds: Math.floor(process.uptime()),
      memory: {
        rssMb: (mem.rss / 1024 / 1024).toFixed(2),
        heapUsedMb: (mem.heapUsed / 1024 / 1024).toFixed(2),
        heapTotalMb: (mem.heapTotal / 1024 / 1024).toFixed(2)
      }
    },
    collaboration: {
      activeRooms: roomManager.getActiveRoomCount(),
      activeConnections: roomManager.getTotalConnectionsCount()
    }
  });
});

export default router;
