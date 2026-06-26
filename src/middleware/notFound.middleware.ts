import type { NextFunction, Request, Response } from 'express';

import { ApiError } from '@/utils/ApiError';

/** Terminal 404 handler: any route that fell through becomes a typed not-found error. */
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}
