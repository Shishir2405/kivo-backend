import type { BaseEntity } from '@/types';

/** How often a habit is expected to be performed. */
export type HabitFrequency = 'daily' | 'weekly' | 'custom';

/** ISO weekday numbers (1 = Monday … 7 = Sunday) used by weekly/custom habits. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * A single completion logged against a `YYYY-MM-DD` day key. `count` lets a habit
 * be completed multiple times in one day (e.g. "drink water" with a daily target).
 */
export interface HabitCompletion {
  /** Day bucket — `YYYY-MM-DD` (see `dates.dayKey`). */
  dayKey: string;
  /** Number of completions logged for this day. */
  count: number;
  /** ISO timestamp of the most recent completion on this day. */
  completedAt: string;
}

export interface Habit extends BaseEntity {
  userId: string;
  name: string;
  /** Display icon / emoji for the habit. */
  emoji: string;
  /** Hex (or token) colour used to render the habit. */
  color: string;
  frequency: HabitFrequency;
  /**
   * Days the habit applies to (ISO weekday numbers). Empty for `daily`; required
   * for `custom`; optional refinement for `weekly`.
   */
  daysOfWeek: Weekday[];
  /** Target number of completions within each period (per day for daily). */
  targetPerPeriod: number;
  /** Local reminder time as `HH:mm`, if the user wants a nudge. */
  reminderTime?: string;
  /** Completion log keyed by day, newest activity surfaced via `lastCompletedDay`. */
  completions: HabitCompletion[];
  /** Consecutive on-target days up to and including the most recent activity. */
  currentStreak: number;
  /** Best streak ever achieved. */
  longestStreak: number;
  /** Lifetime count of individual completions across all days. */
  totalCompletions: number;
  /** Day key of the most recent completion, if any. */
  lastCompletedDay?: string;
  isArchived: boolean;
}

/** A single day in a habit's completion history (used by the history view). */
export interface HabitHistoryEntry {
  dayKey: string;
  count: number;
  /** Whether the day met the habit's `targetPerPeriod`. */
  completed: boolean;
}

/** Computed streak + history snapshot returned alongside a habit. */
export interface HabitStats {
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  /** Whether today's target has already been met. */
  completedToday: boolean;
  history: HabitHistoryEntry[];
}

/** A habit enriched with freshly-computed stats for API responses. */
export interface HabitWithStats extends Habit {
  stats: HabitStats;
}
