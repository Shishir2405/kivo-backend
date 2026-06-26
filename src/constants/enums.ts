/**
 * Domain enumerations shared across modules. Using `as const` objects (rather than TS `enum`)
 * keeps them tree-shakeable, JSON-serialisable, and easy to validate with Zod's `nativeEnum`.
 */

export const UserRole = {
  STUDENT: 'student',
  ADMIN: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const ProblemStatus = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  REVISION_DUE: 'revision_due',
  MASTERED: 'mastered',
} as const;
export type ProblemStatus = (typeof ProblemStatus)[keyof typeof ProblemStatus];

export const ProblemDifficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;
export type ProblemDifficulty = (typeof ProblemDifficulty)[keyof typeof ProblemDifficulty];

export const MasteryLevel = {
  LEARNING: 'learning',
  FAMILIAR: 'familiar',
  PROFICIENT: 'proficient',
  MASTERED: 'mastered',
} as const;
export type MasteryLevel = (typeof MasteryLevel)[keyof typeof MasteryLevel];

export const RevisionStatus = {
  SCHEDULED: 'scheduled',
  DUE: 'due',
  COMPLETED: 'completed',
  SNOOZED: 'snoozed',
  SKIPPED: 'skipped',
} as const;
export type RevisionStatus = (typeof RevisionStatus)[keyof typeof RevisionStatus];

export const ConfidenceRating = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
} as const;
export type ConfidenceRating = (typeof ConfidenceRating)[keyof typeof ConfidenceRating];

export const RevisionEntityType = {
  TOPIC: 'topic',
  PROBLEM: 'problem',
} as const;
export type RevisionEntityType = (typeof RevisionEntityType)[keyof typeof RevisionEntityType];

export const TaskStatus = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export const NotificationType = {
  REVISION_REMINDER: 'revision_reminder',
  DAILY_GOAL: 'daily_goal',
  STUDY_TIMER_COMPLETE: 'study_timer_complete',
  HABIT_REMINDER: 'habit_reminder',
  REFLECTION_REMINDER: 'reflection_reminder',
  WEEKLY_ANALYTICS: 'weekly_analytics',
  MONTHLY_SUMMARY: 'monthly_summary',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
  STREAK_WARNING: 'streak_warning',
  INACTIVITY_REMINDER: 'inactivity_reminder',
  CUSTOM: 'custom',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationStatus = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  READ: 'read',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];
