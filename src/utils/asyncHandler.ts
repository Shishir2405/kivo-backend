import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps an async Express handler so any thrown error / rejected promise is forwarded
 * to `next()` (and therefore the central error middleware) instead of crashing the process.
 *
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler<
  P = Record<string, string>,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Record<string, unknown>,
>(
  fn: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ) => Promise<unknown>,
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
