import type { NextFunction, Request, Response } from 'express';
import { nanoid } from 'nanoid';

const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Assign a correlation id to every request (honouring an inbound `X-Request-Id`
 * if a gateway already set one) and echo it back on the response. Downstream
 * logging + error responses include this id so a single request is traceable
 * end-to-end.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.header(REQUEST_ID_HEADER);
  const id = inbound && inbound.trim().length > 0 ? inbound.trim() : nanoid();
  req.id = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
