import { StatusCodes } from 'http-status-codes';
import type { Response } from 'express';

/**
 * A single, consistent response envelope across the whole API.
 * Every successful payload is `{ success: true, data, meta? }`.
 */
export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export const ApiResponse = {
  ok<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    return send(res, StatusCodes.OK, data, meta);
  },

  created<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    return send(res, StatusCodes.CREATED, data, meta);
  },

  accepted<T>(res: Response, data: T, meta?: Record<string, unknown>): Response {
    return send(res, StatusCodes.ACCEPTED, data, meta);
  },

  noContent(res: Response): Response {
    return res.status(StatusCodes.NO_CONTENT).send();
  },
};

function send<T>(
  res: Response,
  status: number,
  data: T,
  meta?: Record<string, unknown>,
): Response {
  const body: SuccessEnvelope<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}
