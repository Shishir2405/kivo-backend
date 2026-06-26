import { JobName } from '@/constants';
import { createLogger } from '@/utils/logger';

import {
  getAnalyticsQueue,
  getMaintenanceQueue,
  getNotificationQueue,
  getRevisionQueue,
} from './queues';

const log = createLogger('scheduler');

/**
 * Register repeatable jobs. Idempotent: BullMQ dedupes repeatable jobs by
 * (name + repeat options + jobId), so calling this on every worker boot is safe.
 *
 * Cron expressions are evaluated in the server's local timezone.
 */
export async function registerSchedules(): Promise<void> {
  // Sweep for due revisions every 15 minutes (transitions scheduled → due, emits).
  await getRevisionQueue().add(
    JobName.SWEEP_DUE_REVISIONS,
    {},
    {
      repeat: { every: 15 * 60_000 },
      jobId: 'repeat:sweep-due-revisions',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Weekly report — Sundays at 18:00.
  await getAnalyticsQueue().add(
    JobName.GENERATE_WEEKLY_REPORT,
    {},
    {
      repeat: { pattern: '0 18 * * 0' },
      jobId: 'repeat:weekly-report',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Recalculate streaks — daily at 00:30.
  await getAnalyticsQueue().add(
    JobName.RECALCULATE_STREAKS,
    {},
    {
      repeat: { pattern: '30 0 * * *' },
      jobId: 'repeat:recalculate-streaks',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Cleanup expired refresh tokens / stale device tokens — daily at 03:00.
  await getMaintenanceQueue().add(
    JobName.CLEANUP_EXPIRED_TOKENS,
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'repeat:cleanup-expired-tokens',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // ── Notification fan-out schedules ──────────────────────────────────────────
  // Each job walks every user and notifies only those who are eligible. Per-user
  // push prefs and quiet hours are enforced inside notificationService.notify.

  // Habit reminders — daily at 09:00 (nudge for habits not yet done today).
  await getNotificationQueue().add(
    JobName.HABIT_REMINDER,
    {},
    {
      repeat: { pattern: '0 9 * * *' },
      jobId: 'repeat:habit-reminder',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Daily-goal nudge — daily at 19:00.
  await getNotificationQueue().add(
    JobName.DAILY_GOAL_REMINDER,
    {},
    {
      repeat: { pattern: '0 19 * * *' },
      jobId: 'repeat:daily-goal-reminder',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Evening reflection reminder — daily at 21:00.
  await getNotificationQueue().add(
    JobName.REFLECTION_REMINDER,
    {},
    {
      repeat: { pattern: '0 21 * * *' },
      jobId: 'repeat:reflection-reminder',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Inactivity re-engagement — daily at 11:00 (users inactive ≥ 3 days).
  await getNotificationQueue().add(
    JobName.INACTIVITY_REMINDER,
    {},
    {
      repeat: { pattern: '0 11 * * *' },
      jobId: 'repeat:inactivity-reminder',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  // Monthly summary — 1st of each month at 09:00.
  await getAnalyticsQueue().add(
    JobName.MONTHLY_SUMMARY,
    {},
    {
      repeat: { pattern: '0 9 1 * *' },
      jobId: 'repeat:monthly-summary',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  log.info('Repeatable jobs registered');
}
