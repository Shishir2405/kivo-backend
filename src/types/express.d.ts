import type { AuthUser } from './common';

/**
 * Augment Express' Request with the authenticated principal and a per-request id,
 * so downstream handlers get full typing without casts.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Populated by the auth middleware once a valid token is verified. */
      user?: AuthUser;
      /** Correlation id assigned to every request for tracing/logging. */
      id: string;
    }
  }
}

export {};
