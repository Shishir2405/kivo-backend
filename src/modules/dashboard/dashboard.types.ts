/**
 * Read-model shapes for the home-screen dashboard. The dashboard owns no
 * collection of its own — it aggregates revisions, tasks, study sessions,
 * problems and reflections into a single view payload.
 */

/** Kind of activity a schedule/overview item originated from. */
export type DashboardActivityType = 'revision' | 'task' | 'study_session';

/** A revision that is due (or due soon) surfaced on the home screen. */
export interface PendingRevisionItem {
  id: string;
  entityTitle: string;
  entityType: string;
  dueAt: string;
  status: string;
}

/** A task surfaced under "today's tasks". */
export interface TodaysTaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
}

/** An upcoming time-anchored reminder (revision or task) for the rest of today. */
export interface UpcomingReminderItem {
  id: string;
  type: DashboardActivityType;
  title: string;
  remindAt: string;
}

/** Progress against the user's configured daily goals. */
export interface DailyGoals {
  studyMinutesGoal: number;
  studyMinutesDone: number;
  problemsGoal: number;
  problemsDone: number;
  tasksGoal: number;
  tasksDone: number;
}

/** The "today" block of the dashboard. */
export interface TodayOverview {
  pendingRevisionsCount: number;
  pendingRevisions: PendingRevisionItem[];
  todaysTasks: TodaysTaskItem[];
  upcomingReminders: UpcomingReminderItem[];
  dailyGoals: DailyGoals;
}

/** Headline numbers shown as stat cards. */
export interface QuickStats {
  studyHoursToday: number;
  problemsSolved: number;
  tasksCompleted: number;
  revisionCompletionPercent: number;
  weeklyProductivityScore: number;
}

/** A single chronological item in the upcoming schedule. */
export interface UpcomingScheduleItem {
  id: string;
  type: DashboardActivityType;
  title: string;
  scheduledAt: string;
}

/** The greeting / motivation block. */
export interface Welcome {
  greeting: string;
  currentStreak: number;
  dailyQuote: string;
}

/** The full aggregated dashboard payload returned by `GET /dashboard`. */
export interface Dashboard {
  welcome: Welcome;
  todayOverview: TodayOverview;
  quickStats: QuickStats;
  upcomingSchedule: UpcomingScheduleItem[];
}
