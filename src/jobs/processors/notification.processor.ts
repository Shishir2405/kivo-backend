import type { Job } from 'bullmq';

import { JobName } from '@/constants';
import { notificationService } from '@/notifications';
import {
  runDailyGoalReminders,
  runHabitReminders,
  runInactivityReminders,
  runReflectionReminders,
} from '@/notifications/notification.jobs';
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
    case JobName.HABIT_REMINDER: {
      await runHabitReminders();
      return;
    }
    case JobName.REFLECTION_REMINDER: {
      await runReflectionReminders();
      return;
    }
    case JobName.DAILY_GOAL_REMINDER: {
      await runDailyGoalReminders();
      return;
    }
    case JobName.INACTIVITY_REMINDER: {
      await runInactivityReminders();
      return;
    }
    default:
      log.warn({ name: job.name }, 'Unknown notification job');
  }
}
