export * from './collections';
export * from './enums';
export * from './revision';

/** Pagination guard rails applied across all list endpoints. */
export const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  DEFAULT_PAGE: 1,
} as const;

/** Names of the BullMQ queues used by the platform. */
export const QueueName = {
  REVISION: 'revision',
  NOTIFICATION: 'notification',
  ANALYTICS: 'analytics',
  MAINTENANCE: 'maintenance',
} as const;
export type QueueName = (typeof QueueName)[keyof typeof QueueName];

/** Job names within each queue. */
export const JobName = {
  // revision queue
  SCHEDULE_REVISIONS: 'schedule_revisions',
  FIRE_REVISION_REMINDER: 'fire_revision_reminder',
  SWEEP_DUE_REVISIONS: 'sweep_due_revisions',
  // notification queue
  SEND_PUSH: 'send_push',
  HABIT_REMINDER: 'habit_reminder',
  REFLECTION_REMINDER: 'reflection_reminder',
  DAILY_GOAL_REMINDER: 'daily_goal_reminder',
  INACTIVITY_REMINDER: 'inactivity_reminder',
  // analytics queue
  GENERATE_WEEKLY_REPORT: 'generate_weekly_report',
  RECALCULATE_STREAKS: 'recalculate_streaks',
  MONTHLY_SUMMARY: 'monthly_summary',
  // maintenance queue
  CLEANUP_EXPIRED_TOKENS: 'cleanup_expired_tokens',
} as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

/** Socket.IO event names emitted to clients. */
export const SocketEvent = {
  REVISION_DUE: 'revision:due',
  REVISION_UPDATED: 'revision:updated',
  TASK_UPDATED: 'task:updated',
  NOTIFICATION_NEW: 'notification:new',
  DASHBOARD_REFRESH: 'dashboard:refresh',
} as const;
export type SocketEvent = (typeof SocketEvent)[keyof typeof SocketEvent];
