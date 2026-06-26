import type { Job } from 'bullmq';

import { JobName } from '@/constants';
import { notificationService } from '@/notifications';
import { createLogger } from '@/utils/logger';

import type { SendPushPayload } from '../job.types';

const log = createLogger('notification-processor');

/** Handles every job on the notification queue. */
export async function notificationProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case JobName.SEND_PUSH: {
      const data = job.data as SendPushPayload;
      await notificationService.deliver(data.notificationId);
      return;
    }
    default:
      log.warn({ name: job.name }, 'Unknown notification job');
  }
}
