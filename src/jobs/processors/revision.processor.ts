import type { Job } from 'bullmq';

import { JobName } from '@/constants';
import { revisionService } from '@/modules/revisions';
import { createLogger } from '@/utils/logger';

import type {
  FireRevisionReminderPayload,
  ScheduleRevisionsPayload,
} from '../job.types';

const log = createLogger('revision-processor');

/** Handles every job on the revision queue. */
export async function revisionProcessor(job: Job): Promise<void> {
  switch (job.name) {
    case JobName.SCHEDULE_REVISIONS: {
      const data = job.data as ScheduleRevisionsPayload;
      await revisionService.scheduleRevisions(
        data.userId,
        data.entityType,
        data.entityId,
        data.intervals,
      );
      return;
    }
    case JobName.FIRE_REVISION_REMINDER: {
      const data = job.data as FireRevisionReminderPayload;
      await revisionService.fireReminder(data.revisionId);
      return;
    }
    case JobName.SWEEP_DUE_REVISIONS: {
      const transitioned = await revisionService.sweepDueRevisions();
      log.debug({ transitioned }, 'Swept due revisions');
      return;
    }
    default:
      log.warn({ name: job.name }, 'Unknown revision job');
  }
}
