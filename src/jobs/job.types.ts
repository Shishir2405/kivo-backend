import type { RevisionEntityType } from '@/constants';

/** Payload for scheduling a batch of revisions (deferred to the worker). */
export interface ScheduleRevisionsPayload {
  userId: string;
  entityType: RevisionEntityType;
  entityId: string;
  intervals?: number[];
}

/** Payload for firing a single revision reminder (delayed job). */
export interface FireRevisionReminderPayload {
  revisionId: string;
}

/** Payload for the periodic due-revision sweep (no args). */
export type SweepDueRevisionsPayload = Record<string, never>;

/** Payload for delivering a persisted notification via push. */
export interface SendPushPayload {
  notificationId: string;
  userId: string;
}

/** Payload for generating a weekly analytics report. A missing userId means "all users". */
export interface GenerateWeeklyReportPayload {
  userId?: string;
}

/** Payload for the daily streak recalculation. */
export interface RecalculateStreaksPayload {
  userId?: string;
}

/** Payload for the expired-token cleanup job. */
export type CleanupExpiredTokensPayload = Record<string, never>;
