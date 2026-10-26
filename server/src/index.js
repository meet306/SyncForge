import http from 'http';
import dotenv from 'dotenv';
import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { initRedis } from './config/redis.js';
import { setupCollaborationServer, roomManager } from './collaboration/server.js';
import { verifySMTP } from './services/emailService.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  try {
    // 1. Connect Persistent Database
    await connectDB();

    // 2. Initialize Redis (with resilient fallback)
    await initRedis();

    // 3. Verify SMTP Email Gateway
    await verifySMTP();

    // 3. Create HTTP & Collaboration Servers
    const app = createApp();
    const server = http.createServer(app);

    setupCollaborationServer(server);

    server.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`🚀 SyncForge Server is running on port ${PORT}`);
      console.log(`📡 WebSocket Collaboration Endpoint: ws://localhost:${PORT}/collaboration/:id`);
      console.log(`🌐 Health Check: http://localhost:${PORT}/health`);
      console.log(`=======================================================`);
    });

    // 4. Graceful Shutdown Handlers
    const handleShutdown = async (signal) => {
      console.log(`\n[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

      server.close(async () => {
        console.log('[Shutdown] Closed HTTP and WebSocket listener.');
        try {
          await roomManager.flushAll();
          await disconnectDB();
          console.log('[Shutdown] Graceful shutdown completed cleanly.');
          process.exit(0);
        } catch (err) {
          console.error('[Shutdown Error] Error during teardown:', err);
          process.exit(1);
        }
      });

      // Force exit after 10s if shutdown hangs
      setTimeout(() => {
        console.error('[Shutdown Timeout] Forcing immediate termination.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (err) {
    console.error('[Fatal Bootstrap Error]:', err);
    process.exit(1);
  }
}

bootstrap();
