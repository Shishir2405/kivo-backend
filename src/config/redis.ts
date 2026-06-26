import { Redis, type RedisOptions } from 'ioredis';

import { createLogger } from '@/utils/logger';

import { config } from './index';

const log = createLogger('redis');

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
    lazyConnect: false,
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
