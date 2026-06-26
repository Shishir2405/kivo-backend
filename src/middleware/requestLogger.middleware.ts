import { pinoHttp } from 'pino-http';

import { logger } from '@/utils/logger';

/**
 * HTTP request logger built on the shared Pino instance. Reuses the app logger's
 * redaction config and tags each line with the request's correlation id (set by
 * the requestId middleware, which must run first).
 */
export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const existing = (req as { id?: string }).id;
    if (existing) {
      res.setHeader('X-Request-Id', existing);
      return existing;
    }
    return res.getHeader('X-Request-Id')?.toString() ?? '';
  },
  autoLogging: true,
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
  customErrorMessage: (req, res, err) =>
    `${req.method} ${req.url} -> ${res.statusCode} (${err.message})`,
});
