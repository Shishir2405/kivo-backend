import compression from 'compression';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import helmet from 'helmet';

import { config } from '@/config';
import { pingRedis } from '@/config/redis';
import { pingFirestore } from '@/firebase/firestore';
import { errorHandler } from '@/middleware/error.middleware';
import { notFound } from '@/middleware/notFound.middleware';
import { requestId } from '@/middleware/requestId.middleware';
import { requestLogger } from '@/middleware/requestLogger.middleware';
import { buildRouter } from '@/routes';
import { asyncHandler } from '@/utils/asyncHandler';

/**
 * Build and configure the Express application.
 *
 * Middleware order matters: security + body parsing first, then per-request id
 * and logging, health probes at the root, the versioned API surface, and finally
 * the 404 + central error handler (which must be registered last).
 */
export function createApp(): Application {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.app.corsOrigins.length > 0 ? config.app.corsOrigins : true,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.use(requestId);
  app.use(requestLogger);

  // Liveness — process is up and serving.
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() },
    });
  });

  // Readiness — dependencies (Redis + Firestore) are reachable.
  app.get(
    '/health/ready',
    asyncHandler(async (_req: Request, res: Response) => {
      const [redis, firestore] = await Promise.all([pingRedis(), pingFirestore()]);
      const ready = redis && firestore;
      res.status(ready ? 200 : 503).json({
        success: ready,
        data: { status: ready ? 'ready' : 'not_ready', redis, firestore },
      });
    }),
  );

  app.use(config.app.apiPrefix, buildRouter());

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
