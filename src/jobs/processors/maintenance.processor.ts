import type { Job } from 'bullmq';

import { JobName } from '@/constants';
import { authService } from '@/modules/auth';
import { createLogger } from '@/utils/logger';

const log = createLogger('maintenance-processor');

/** Handles every job on the maintenance queue. */
export async function maintenanceProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case JobName.CLEANUP_EXPIRED_TOKENS: {
      const removed = await authService.cleanupExpiredRefreshTokens();
      log.debug({ removed }, 'Cleaned up expired refresh tokens');
      return;
    }
    default:
      log.warn({ name: job.name }, 'Unknown maintenance job');
  }
}
