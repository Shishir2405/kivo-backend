import { createServer, type Server as HttpServer } from 'node:http';

import { config } from '@/config';
import { closeRedis } from '@/config/redis';
import { initFirebase } from '@/firebase/admin';
import { closeQueues, registerSchedules } from '@/jobs';
import { closeSocket, initSocket } from '@/socket';
import { logger } from '@/utils/logger';

import { createApp } from './app';

let httpServer: HttpServer | null = null;
let shuttingDown = false;

async function bootstrap(): Promise<void> {
  // Initialise external dependencies before accepting traffic.
  initFirebase();

  const app = createApp();
  httpServer = createServer(app);

  // Real-time channel shares the HTTP server.
  initSocket(httpServer);

  // Register repeatable/cron jobs (producer-side only — workers run separately).
  await registerSchedules();

  await new Promise<void>((resolve) => {
    httpServer!.listen(config.app.port, config.app.host, () => resolve());
  });

  logger.info(
    {
      port: config.app.port,
      host: config.app.host,
      env: config.env,
      apiPrefix: config.app.apiPrefix,
    },
    `${config.app.name} API listening on http://${config.app.host}:${config.app.port}`,
  );
}

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Shutting down gracefully');

  try {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
    }
    await closeSocket();
    await closeQueues();
    await closeRedis();
    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  void shutdown('uncaughtException');
});

bootstrap().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
