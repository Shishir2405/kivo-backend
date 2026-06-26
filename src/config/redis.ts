import { Redis, type RedisOptions } from 'ioredis';

import { createLogger } from '@/utils/logger';

import { config } from './index';

const log = createLogger('redis');

/**
 * Whether Redis is meaningfully configured. A bare default host (`127.0.0.1`) with
 * no password is treated as "not configured" so serverless deploys don't try to dial
 * a non-existent local Redis. Redis powers BullMQ + the distributed rate limiter;
 * when absent the rate limiter falls back to in-memory and job enqueues no-op.
 */
export function isRedisConfigured(): boolean {
  if (config.redis.url) return true;
  const usingDefaultHost =
    config.redis.host === '127.0.0.1' || config.redis.host === 'localhost';
  return !usingDefaultHost || Boolean(config.redis.password);
}

/**
 * Build ioredis connection options from validated config.
 *
 * `maxRetriesPerRequest: null` and `enableReadyCheck: false` are required by BullMQ,
 * and are safe for the shared cache client too, so we use one option builder.
 */
export function buildRedisOptions(overrides: Partial<RedisOptions> = {}): RedisOptions {
  const base: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    // Lazy connect: don't dial Redis at construction time. This is essential for
    // serverless — importing a module that builds a client (e.g. BullMQ queues)
    // must not trigger a TCP connection at import. The connection is established
    // on the first command (ping/add/etc.).
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5_000);
      return delay;
    },
    reconnectOnError(err) {
      // Reconnect on READONLY errors (replica failover).
      return err.message.includes('READONLY');
    },
  };

  if (config.redis.url) {
    return { ...base, ...overrides };
  }

  return {
    host: config.redis.host,
    port: config.redis.port,
    db: config.redis.db,
    ...(config.redis.password ? { password: config.redis.password } : {}),
    ...(config.redis.tls ? { tls: {} } : {}),
    ...base,
    ...overrides,
  };
}

/**
 * Create a new Redis connection. Each call returns an independent client —
 * BullMQ requires dedicated connections per queue/worker, so callers manage lifecycle.
 */
export function createRedisConnection(overrides: Partial<RedisOptions> = {}): Redis {
  const client = config.redis.url
    ? new Redis(config.redis.url, buildRedisOptions(overrides))
    : new Redis(buildRedisOptions(overrides));

  client.on('error', (err) => log.error({ err }, 'Redis connection error'));
  client.on('connect', () => log.debug('Redis connecting'));
  client.on('ready', () => log.info('Redis ready'));
  client.on('close', () => log.warn('Redis connection closed'));
  client.on('reconnecting', () => log.warn('Redis reconnecting'));

  return client;
}

/**
 * Shared, app-wide cache client (sessions, rate-limiting, ad-hoc caching).
 * BullMQ creates its own connections — see `jobs/connection.ts`.
 */
let cacheClient: Redis | null = null;

export function getRedis(): Redis {
  if (!cacheClient) {
    cacheClient = createRedisConnection();
  }
  return cacheClient;
}

export async function pingRedis(): Promise<boolean> {
  if (!isRedisConfigured()) return false;
  try {
    const res = await getRedis().ping();
    return res === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  if (cacheClient) {
    await cacheClient.quit().catch(() => cacheClient?.disconnect());
    cacheClient = null;
    log.info('Redis cache client closed');
  }
}
