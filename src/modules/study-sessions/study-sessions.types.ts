import type { BaseEntity } from '@/types';

/** Kind of timer used to drive the study session. */
export type TimerType = 'pomodoro' | 'deep_focus' | 'stopwatch' | 'countdown' | 'custom';

export interface StudySession extends BaseEntity {
  userId: string;
  timerType: TimerType;
  /** When the session began (ISO-8601). */
  startTime: string;
  /** When the session ended (ISO-8601). */
  endTime: string;
  /** Focused duration in minutes. */
  durationMinutes: number;
  /** Optional linked topic. */
  topicId?: string;
  topicName?: string;
  notes?: string;
  /** Number of times the session was interrupted. */
  interruptions: number;
}

/** Aggregated focus totals for the summary endpoint. */
export interface StudySessionSummary {
  todayMinutes: number;
  weekMinutes: number;
  todaySessions: number;
  weekSessions: number;
}
