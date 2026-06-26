import type { BaseEntity } from '@/types';

// ──────────────────────────────────────────────────────────────────────────
// Source entity shapes
//
// This module is read/aggregation-heavy and queries sibling collections
// directly (study_sessions, habits, …) rather than importing their modules.
// These interfaces describe only the fields the analytics aggregations rely
// on; the owning modules remain the source of truth for the full shape.
// ──────────────────────────────────────────────────────────────────────────

/** A focus/study session logged against the Pomodoro/study timer. */
export interface StudySessionDoc extends BaseEntity {
  userId: string;
  /** Optional topic this session was focused on. */
  topicId?: string;
  /** Denormalised topic title for reporting. */
  topicTitle?: string;
  /** Logged focus duration in minutes. */
  durationMinutes: number;
  /** When the session started (ISO-8601). */
  startedAt?: string;
  /** When the session completed (ISO-8601). */
  completedAt?: string;
  /** Whether the session ran to completion (vs. abandoned). */
  isCompleted?: boolean;
}

/** A single habit and its per-day completion log. */
export interface HabitDoc extends BaseEntity {
  userId: string;
  name: string;
  /** Day keys (`YYYY-MM-DD`) on which the habit was completed. */
  completedDates: string[];
  isArchived?: boolean;
}

/** Per-day-key contribution count, the unit of the heatmap. */
export interface HeatmapCell {
  /** Inclusive day key `YYYY-MM-DD`. */
  date: string;
  /** Total contributions across all tracked activities on this day. */
  count: number;
  /** Breakdown of the count by activity source. */
  breakdown: ContributionBreakdown;
}

/** Contributions split by their originating activity. */
export interface ContributionBreakdown {
  studySessions: number;
  problemsSolved: number;
  revisionsCompleted: number;
  tasksCompleted: number;
  habitCompletions: number;
}

export type HeatmapRange = '30' | '90' | '365' | 'lifetime';

export interface HeatmapResult {
  range: HeatmapRange;
  /** First day key included in the heatmap. */
  startDate: string;
  /** Last day key included in the heatmap (today). */
  endDate: string;
  /** Sum of all contribution counts in the window. */
  totalContributions: number;
  /** Number of distinct days with at least one contribution. */
  activeDays: number;
  cells: HeatmapCell[];
}

export interface StreaksResult {
  /** Consecutive days up to today with study activity. */
  currentDailyStreak: number;
  /** Longest run of consecutive active days, ever. */
  longestDailyStreak: number;
  /** Consecutive ISO weeks up to this week with study activity. */
  currentWeeklyStreak: number;
  /** Longest run of consecutive active ISO weeks, ever. */
  longestWeeklyStreak: number;
  /** Day key the current daily streak started on, if active. */
  streakStartDate?: string;
  /** Most recent active day key, if any. */
  lastActiveDate?: string;
}

export interface TopicMetric {
  topicId: string;
  topicTitle: string;
  /** Problems solved for this topic within the window. */
  problemsSolved: number;
  /** Study minutes logged for this topic within the window. */
  studyMinutes: number;
}

export interface WeeklyReport extends BaseEntity {
  userId: string;
  /** Monday-00:00 ISO timestamp of the reported ISO week. */
  weekStart: string;
  /** Exclusive end (next Monday) ISO timestamp. */
  weekEnd: string;
  studyHours: number;
  problemsSolved: number;
  topicsCompleted: number;
  /** 0-100 completion rate of revisions due in the window. */
  revisionCompletionRate: number;
  /** 0-100 completion rate of tasks due in the window. */
  taskCompletionRate: number;
  /** Number of completed focus/study sessions. */
  focusSessions: number;
  /** 0-100 habit completion rate across active habits over the 7 days. */
  habitCompletionRate: number;
  /** Longest single focus session, in minutes. */
  longestSessionMinutes: number;
  strongestTopic?: TopicMetric;
  weakestTopic?: TopicMetric;
  /** 0-100 composite productivity score. */
  productivityScore: number;
  recommendations: string[];
}
