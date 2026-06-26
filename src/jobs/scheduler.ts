import { JobName } from '@/constants';
import { createLogger } from '@/utils/logger';

import { analyticsQueue, maintenanceQueue, revisionQueue } from './queues';

const log = createLogger('scheduler');

/**
 * Register repeatable jobs. Idempotent: BullMQ dedupes repeatable jobs by
 * (name + repeat options + jobId), so calling this on every worker boot is safe.
 *
 * Cron expressions are evaluated in the server's local timezone.
 */
export async function registerSchedules(): Promise<void> {
  // Sweep for due revisions every 15 minutes (transitions scheduled → due, emits).
  await revisionQueue.add(
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
  await analyticsQueue.add(
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
  await analyticsQueue.add(
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
  await maintenanceQueue.add(
    JobName.CLEANUP_EXPIRED_TOKENS,
    {},
    {
      repeat: { pattern: '0 3 * * *' },
      jobId: 'repeat:cleanup-expired-tokens',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );

  log.info('Repeatable jobs registered');
}
