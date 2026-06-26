import type { Redis } from 'ioredis';

import { createRedisConnection } from '@/config/redis';

/**
 * Shared Redis connection for BullMQ. BullMQ requires `maxRetriesPerRequest: null`
 * and `enableReadyCheck: false`, which `buildRedisOptions` already sets, so a plain
 * `createRedisConnection()` is BullMQ-compatible.
 *
 * Created LAZILY on first use (not at import). Importing this module — which happens
 * transitively whenever a service imports an `enqueue*` helper — must never open a
 * Redis socket, otherwise serverless functions crash at boot when Redis is absent.
 * Queues (API/producer) and Workers (worker process) both call `getBullConnection()`.
 */
let connection: Redis | null = null;

export function getBullConnection(): Redis {
  if (!connection) {
    connection = createRedisConnection();
  }
  return connection;
}

export async function closeBullConnection(): Promise<void> {
  if (connection) {
    await connection.quit().catch(() => connection?.disconnect());
    connection = null;
  }
}
