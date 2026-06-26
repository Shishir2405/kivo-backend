import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore, type RedisReply } from 'rate-limit-redis';

import { config } from '@/config';
import { getRedis } from '@/config/redis';
import { ApiError } from '@/utils/ApiError';

/**
 * Build a Redis-backed limiter so limits are enforced consistently across every
 * API instance (in-memory limiters would let each replica grant the full quota).
 */
function buildLimiter(overrides: Partial<Options> = {}) {
  const baseOptions: Partial<Options> = {
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({
      // ioredis `call(command, ...args)` needs the command as the first tuple element.
      sendCommand: (command: string, ...args: string[]) =>
        getRedis().call(command, ...args) as Promise<RedisReply>,
      prefix: `${config.bullmq.prefix}:rl:`,
    }),
    handler: (_req, _res, next) => {
      next(ApiError.tooManyRequests('Too many requests, please slow down'));
    },
    ...overrides,
  };
  return rateLimit(baseOptions);
}

/** Default limiter applied to the whole API surface. */
export const apiLimiter = buildLimiter();

/**
 * Stricter limiter for authentication endpoints (login/register/refresh) to blunt
 * credential-stuffing and brute-force attempts.
 */
export const authLimiter = buildLimiter({
  windowMs: 15 * 60_000,
  max: 20,
  handler: (_req, _res, next) => {
    next(ApiError.tooManyRequests('Too many authentication attempts, please try again later'));
  },
});

export { buildLimiter };
