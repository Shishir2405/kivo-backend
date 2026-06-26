import { Queue, type JobsOptions } from 'bullmq';

import { config } from '@/config';
import { JobName, QueueName } from '@/constants';

import { bullConnection } from './connection';
import type {
  CleanupExpiredTokensPayload,
  FireRevisionReminderPayload,
  GenerateWeeklyReportPayload,
  RecalculateStreaksPayload,
  ScheduleRevisionsPayload,
  SendPushPayload,
  SweepDueRevisionsPayload,
} from './job.types';

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: { age: 24 * 3_600, count: 1_000 },
  removeOnFail: { age: 7 * 24 * 3_600 },
};

function makeQueue(name: QueueName): Queue {
  return new Queue(name, {
    connection: bullConnection,
    prefix: config.bullmq.prefix,
    defaultJobOptions,
  });
}

/** One queue per logical workstream. Producers (API) and consumers (worker) share names. */
export const revisionQueue = makeQueue(QueueName.REVISION);
export const notificationQueue = makeQueue(QueueName.NOTIFICATION);
export const analyticsQueue = makeQueue(QueueName.ANALYTICS);
export const maintenanceQueue = makeQueue(QueueName.MAINTENANCE);

export const queues: Record<QueueName, Queue> = {
  [QueueName.REVISION]: revisionQueue,
  [QueueName.NOTIFICATION]: notificationQueue,
  [QueueName.ANALYTICS]: analyticsQueue,
  [QueueName.MAINTENANCE]: maintenanceQueue,
};

// ── Typed enqueue helpers ──────────────────────────────────────────────────
// Services import these (never the workers) so there are no producer→consumer cycles.

export async function enqueueScheduleRevisions(
  payload: ScheduleRevisionsPayload,
): Promise<void> {
  await revisionQueue.add(JobName.SCHEDULE_REVISIONS, payload);
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
  const payload: FireRevisionReminderPayload = { revisionId };
  await revisionQueue.add(JobName.FIRE_REVISION_REMINDER, payload, {
    delay: Math.max(0, Math.floor(delayMs)),
    jobId: `revision-reminder:${revisionId}`,
  });
}

export async function enqueueSweepDueRevisions(): Promise<void> {
  const payload: SweepDueRevisionsPayload = {};
  await revisionQueue.add(JobName.SWEEP_DUE_REVISIONS, payload);
}

export async function enqueueSendPush(payload: SendPushPayload): Promise<void> {
  await notificationQueue.add(JobName.SEND_PUSH, payload);
}

export async function enqueueWeeklyReport(userId?: string): Promise<void> {
  const payload: GenerateWeeklyReportPayload = userId ? { userId } : {};
  await analyticsQueue.add(JobName.GENERATE_WEEKLY_REPORT, payload);
}

export async function enqueueRecalculateStreaks(userId?: string): Promise<void> {
  const payload: RecalculateStreaksPayload = userId ? { userId } : {};
  await analyticsQueue.add(JobName.RECALCULATE_STREAKS, payload);
}

export async function enqueueCleanupExpiredTokens(): Promise<void> {
  const payload: CleanupExpiredTokensPayload = {};
  await maintenanceQueue.add(JobName.CLEANUP_EXPIRED_TOKENS, payload);
}

export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((q) => q.close()));
}
