import type { Job } from 'bullmq';

import { JobName } from '@/constants';
import { analyticsService } from '@/modules/analytics';
import { createLogger } from '@/utils/logger';

import type {
  GenerateWeeklyReportPayload,
  RecalculateStreaksPayload,
} from '../job.types';

const log = createLogger('analytics-processor');

/** Handles every job on the analytics queue. */
export async function analyticsProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case JobName.GENERATE_WEEKLY_REPORT: {
      const data = job.data as GenerateWeeklyReportPayload;
      const count = await analyticsService.generateWeeklyReports(data.userId);
      log.debug({ count }, 'Generated weekly reports');
      return;
    }
    case JobName.RECALCULATE_STREAKS: {
      const data = job.data as RecalculateStreaksPayload;
      const count = await analyticsService.recalculateStreaks(data.userId);
      log.debug({ count }, 'Recalculated streaks');
      return;
    }
    default:
      log.warn({ name: job.name }, 'Unknown analytics job');
  }
}
