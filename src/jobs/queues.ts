import { Queue, type JobsOptions } from 'bullmq';

import { config } from '@/config';
import { isRedisConfigured } from '@/config/redis';
import { JobName, QueueName } from '@/constants';
import { createLogger } from '@/utils/logger';

import { getBullConnection } from './connection';
import type {
  CleanupExpiredTokensPayload,
  FireRevisionReminderPayload,
  GenerateWeeklyReportPayload,
  RecalculateStreaksPayload,
  ScheduleRevisionsPayload,
  SendPushPayload,
  SweepDueRevisionsPayload,
} from './job.types';

const log = createLogger('queues');

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600 },
};

function makeQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: getBullConnection(),
    prefix: config.bullmq.prefix,
    defaultJobOptions,
  });
}

/**
 * Queues are created LAZILY (and memoised) on first access, never at import. This
 * keeps the API process — and serverless functions in particular — from touching
 * BullMQ/Redis just because a service module imports an `enqueue*` helper.
 */
const queueCache = new Map<QueueName, Queue>();

function getQueue(name: QueueName): Queue {
  let queue = queueCache.get(name);
  if (!queue) {
    queue = makeQueue(name);
    queueCache.set(name, queue);
  }
  return queue;
}

/** One queue per logical workstream. Producers (API) and consumers (worker) share names. */
export const getRevisionQueue = (): Queue => getQueue(QueueName.REVISION);
export const getNotificationQueue = (): Queue => getQueue(QueueName.NOTIFICATION);
export const getAnalyticsQueue = (): Queue => getQueue(QueueName.ANALYTICS);
export const getMaintenanceQueue = (): Queue => getQueue(QueueName.MAINTENANCE);

/**
 * Guard every enqueue: when Redis isn't configured (e.g. Vercel serverless with no
 * REDIS_URL) we cannot reach BullMQ, so the helper no-ops and warns instead of
 * throwing. Background work is simply skipped — the request path still succeeds.
 * Returns `true` when the job was enqueued, `false` when skipped.
 */
function redisAvailable(action: string): boolean {
  if (isRedisConfigured()) return true;
  log.warn({ action }, 'Redis not configured — skipping background job enqueue');
  return false;
}

// ── Typed enqueue helpers ──────────────────────────────────────────────────
// Services import these (never the workers) so there are no producer→consumer cycles.

export async function enqueueScheduleRevisions(
  payload: ScheduleRevisionsPayload,
): Promise<void> {
  if (!redisAvailable('scheduleRevisions')) return;
  await getRevisionQueue().add(JobName.SCHEDULE_REVISIONS, payload);
}

/**
 * Schedule a one-shot revision reminder to fire after `delayMs`. Uses a deterministic
 * jobId so re-scheduling the same revision replaces the pending job instead of
 * stacking duplicates.
 */
export async function enqueueRevisionReminder(
  revisionId: string,
  delayMs: number,
): Promise<void> {
  if (!redisAvailable('revisionReminder')) return;
  const payload: FireRevisionReminderPayload = { revisionId };
  await getRevisionQueue().add(JobName.FIRE_REVISION_REMINDER, payload, {
    delay: Math.max(0, Math.floor(delayMs)),
    jobId: `revision-reminder:${revisionId}`,
  });
}

export async function enqueueSweepDueRevisions(): Promise<void> {
  if (!redisAvailable('sweepDueRevisions')) return;
  const payload: SweepDueRevisionsPayload = {};
  await getRevisionQueue().add(JobName.SWEEP_DUE_REVISIONS, payload);
}

export async function enqueueSendPush(payload: SendPushPayload): Promise<void> {
  if (!redisAvailable('sendPush')) return;
  await getNotificationQueue().add(JobName.SEND_PUSH, payload);
}

export async function enqueueWeeklyReport(userId?: string): Promise<void> {
  if (!redisAvailable('weeklyReport')) return;
  const payload: GenerateWeeklyReportPayload = userId ? { userId } : {};
  await getAnalyticsQueue().add(JobName.GENERATE_WEEKLY_REPORT, payload);
}

export async function enqueueRecalculateStreaks(userId?: string): Promise<void> {
  if (!redisAvailable('recalculateStreaks')) return;
  const payload: RecalculateStreaksPayload = userId ? { userId } : {};
  await getAnalyticsQueue().add(JobName.RECALCULATE_STREAKS, payload);
}

export async function enqueueCleanupExpiredTokens(): Promise<void> {
  if (!redisAvailable('cleanupExpiredTokens')) return;
  const payload: CleanupExpiredTokensPayload = {};
  await getMaintenanceQueue().add(JobName.CLEANUP_EXPIRED_TOKENS, payload);
}

export async function closeQueues(): Promise<void> {
  await Promise.all([...queueCache.values()].map((q) => q.close()));
  queueCache.clear();
}
