import type { Redis } from 'ioredis';

import { createRedisConnection } from '@/config/redis';

/**
 * Shared Redis connection for BullMQ. BullMQ requires `maxRetriesPerRequest: null`
 * and `enableReadyCheck: false`, which `buildRedisOptions` already sets, so a plain
 * `createRedisConnection()` is BullMQ-compatible.
 *
 * Queues (producer side, in the API process) and Workers (consumer side, in the
 * worker process) both reference this. It is created lazily on first import.
 */
export const bullConnection: Redis = createRedisConnection();
