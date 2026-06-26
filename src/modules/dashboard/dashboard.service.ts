import type { DocumentData } from 'firebase-admin/firestore';

import {
  Collections,
  ProblemStatus,
  RevisionStatus,
  TaskStatus,
} from '@/constants';
import { collection } from '@/firebase/firestore';
import { dayjs, dayKey, nowIso } from '@/utils/dates';

import type {
  Dashboard,
  DailyGoals,
  DashboardActivityType,
  PendingRevisionItem,
  QuickStats,
  TodayOverview,
  TodaysTaskItem,
  UpcomingReminderItem,
  UpcomingScheduleItem,
  Welcome,
} from './dashboard.types';

/** Revision statuses that count as "still needs revising". */
const OPEN_REVISION_STATUSES: string[] = [
  RevisionStatus.SCHEDULED,
  RevisionStatus.DUE,
  RevisionStatus.SNOOZED,
];

/** Task statuses that are still actionable (not done/cancelled). */
const OPEN_TASK_STATUSES: string[] = [
  TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.OVERDUE,
];

/** Sensible fallbacks when a user has no preferences persisted yet. */
const FALLBACK_STUDY_GOAL_MINUTES = 120;
const FALLBACK_PROBLEM_GOAL = 3;
const FALLBACK_TASKS_GOAL = 5;

/** How many items each home-screen list caps at. */
const PENDING_REVISIONS_LIMIT = 10;
const TODAYS_TASKS_LIMIT = 10;
const UPCOMING_REMINDERS_LIMIT = 5;
const UPCOMING_SCHEDULE_LIMIT = 10;

/**
 * Deterministic daily motivational quotes. Picked by day-of-year modulo length
 * so the choice is stable across requests on the same day (no randomness).
 */
const DAILY_QUOTES: readonly string[] = [
  'The secret of getting ahead is getting started.',
  'Small daily improvements are the key to staggering long-term results.',
  'Discipline is choosing between what you want now and what you want most.',
  'Success is the sum of small efforts repeated day in and day out.',
  'Focus on being productive instead of busy.',
  'The expert in anything was once a beginner.',
  'It always seems impossible until it is done.',
  'Practice does not make perfect. Perfect practice makes perfect.',
  'Strive for progress, not perfection.',
  'A little progress each day adds up to big results.',
  'Do not watch the clock; do what it does — keep going.',
  'The best way to predict the future is to create it.',
  'Consistency is what transforms average into excellence.',
  'You do not have to be great to start, but you have to start to be great.',
  'Hard work beats talent when talent does not work hard.',
];

/** Minimal raw document shapes we read from Firestore in this module. */
interface RevisionDoc extends DocumentData {
  userId: string;
  entityTitle: string;
  entityType: string;
  dueAt: string;
  status: string;
  completedAt?: string;
}

interface TaskDoc extends DocumentData {
  userId: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  reminderAt?: string;
  completedAt?: string;
}

interface StudySessionDoc extends DocumentData {
  userId: string;
  startTime: string;
  durationMinutes: number;
}

interface ProblemDoc extends DocumentData {
  userId: string;
  status: string;
  dateSolved?: string;
}

interface ReflectionDoc extends DocumentData {
  userId: string;
  dayKey: string;
  goalsCompleted: boolean;
}

interface UserDoc extends DocumentData {
  currentStreak?: number;
  preferences?: {
    dailyStudyGoalMinutes?: number;
    dailyProblemGoal?: number;
  };
}

interface WithId {
  id: string;
}

/** Build the time-of-day greeting from the local hour. */
function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/** Deterministically pick today's quote by day-of-year modulo array length. */
function quoteForDay(reference = new Date()): string {
  const dayOfYear = dayjs(reference).diff(dayjs(reference).startOf('year'), 'day');
  const index = ((dayOfYear % DAILY_QUOTES.length) + DAILY_QUOTES.length) % DAILY_QUOTES.length;
  // Length is a non-zero constant, so this index is always in-bounds.
  return DAILY_QUOTES[index] as string;
}

/** Round to one decimal place for human-friendly stat cards. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export class DashboardService {
  /** Aggregate the full home-screen payload for a user. */
  async getDashboard(userId: string): Promise<Dashboard> {
    const now = dayjs();
    const startOfDay = now.startOf('day');
    const endOfDay = now.endOf('day');
    const startOfWeek = now.startOf('isoWeek');
    const nowIsoStr = nowIso();
    const startOfDayIso = startOfDay.toISOString();
    const endOfDayIso = endOfDay.toISOString();
    const startOfWeekIso = startOfWeek.toISOString();
    const todayKey = dayKey();

    const [revisions, tasks, sessions, problems, reflections, user] = await Promise.all([
      this.fetchRevisions(userId),
      this.fetchTasks(userId),
      this.fetchStudySessionsSince(userId, startOfWeekIso),
      this.fetchProblemsSolvedSince(userId, startOfDayIso),
      this.fetchReflectionsSince(userId, startOfWeek.format('YYYY-MM-DD')),
      this.fetchUser(userId),
    ]);

    const welcome = this.buildWelcome(user, now.hour());
    const todayOverview = this.buildTodayOverview(
      revisions,
      tasks,
      sessions,
      problems,
      user,
      { nowIso: nowIsoStr, startOfDayIso, endOfDayIso, startOfWeekIso },
    );
    const quickStats = this.buildQuickStats(
      revisions,
      tasks,
      sessions,
      problems,
      reflections,
      { startOfDayIso, endOfDayIso, todayKey },
    );
    const upcomingSchedule = this.buildUpcomingSchedule(
      revisions,
      tasks,
      sessions,
      nowIsoStr,
    );

    return { welcome, todayOverview, quickStats, upcomingSchedule };
  }

  // ── Firestore reads (direct, to avoid coupling to sibling repositories) ──

  private async fetchRevisions(userId: string): Promise<(RevisionDoc & WithId)[]> {
    const snap = await collection<RevisionDoc>(Collections.REVISIONS)
      .where('userId', '==', userId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async fetchTasks(userId: string): Promise<(TaskDoc & WithId)[]> {
    const snap = await collection<TaskDoc>(Collections.TASKS)
      .where('userId', '==', userId)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async fetchStudySessionsSince(
    userId: string,
    sinceIso: string,
  ): Promise<(StudySessionDoc & WithId)[]> {
    const snap = await collection<StudySessionDoc>(Collections.STUDY_SESSIONS)
      .where('userId', '==', userId)
      .where('startTime', '>=', sinceIso)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async fetchProblemsSolvedSince(
    userId: string,
    sinceIso: string,
  ): Promise<(ProblemDoc & WithId)[]> {
    const snap = await collection<ProblemDoc>(Collections.PROBLEMS)
      .where('userId', '==', userId)
      .where('status', '==', ProblemStatus.COMPLETED)
      .where('dateSolved', '>=', sinceIso)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async fetchReflectionsSince(
    userId: string,
    sinceDayKey: string,
  ): Promise<(ReflectionDoc & WithId)[]> {
    const snap = await collection<ReflectionDoc>(Collections.REFLECTIONS)
      .where('userId', '==', userId)
      .where('dayKey', '>=', sinceDayKey)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  private async fetchUser(userId: string): Promise<UserDoc | null> {
    const snap = await collection<UserDoc>(Collections.USERS).doc(userId).get();
    return snap.exists ? (snap.data() ?? null) : null;
  }

  // ── Section builders ──

  private buildWelcome(user: UserDoc | null, hour: number): Welcome {
    return {
      greeting: greetingForHour(hour),
      currentStreak: user?.currentStreak ?? 0,
      dailyQuote: quoteForDay(),
    };
  }

  private buildTodayOverview(
    revisions: (RevisionDoc & WithId)[],
    tasks: (TaskDoc & WithId)[],
    sessions: (StudySessionDoc & WithId)[],
    problems: (ProblemDoc & WithId)[],
    user: UserDoc | null,
    bounds: { nowIso: string; startOfDayIso: string; endOfDayIso: string; startOfWeekIso: string },
  ): TodayOverview {
    const pending = revisions
      .filter(
        (r) =>
          OPEN_REVISION_STATUSES.includes(r.status) && r.dueAt <= bounds.endOfDayIso,
      )
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

    const pendingRevisions: PendingRevisionItem[] = pending
      .slice(0, PENDING_REVISIONS_LIMIT)
      .map((r) => ({
        id: r.id,
        entityTitle: r.entityTitle,
        entityType: r.entityType,
        dueAt: r.dueAt,
        status: r.status,
      }));

    const todaysTasks: TodaysTaskItem[] = tasks
      .filter(
        (t) =>
          OPEN_TASK_STATUSES.includes(t.status) &&
          t.dueDate !== undefined &&
          t.dueDate >= bounds.startOfDayIso &&
          t.dueDate <= bounds.endOfDayIso,
      )
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, TODAYS_TASKS_LIMIT)
      .map((t) => {
        const item: TodaysTaskItem = {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
        };
        if (t.dueDate !== undefined) item.dueDate = t.dueDate;
        return item;
      });

    const reminders: UpcomingReminderItem[] = [];
    for (const r of revisions) {
      if (
        OPEN_REVISION_STATUSES.includes(r.status) &&
        r.dueAt >= bounds.nowIso &&
        r.dueAt <= bounds.endOfDayIso
      ) {
        reminders.push({
          id: r.id,
          type: 'revision',
          title: r.entityTitle,
          remindAt: r.dueAt,
        });
      }
    }
    for (const t of tasks) {
      if (
        OPEN_TASK_STATUSES.includes(t.status) &&
        t.reminderAt !== undefined &&
        t.reminderAt >= bounds.nowIso &&
        t.reminderAt <= bounds.endOfDayIso
      ) {
        reminders.push({
          id: t.id,
          type: 'task',
          title: t.title,
          remindAt: t.reminderAt,
        });
      }
    }
    reminders.sort((a, b) => a.remindAt.localeCompare(b.remindAt));
    const upcomingReminders = reminders.slice(0, UPCOMING_REMINDERS_LIMIT);

    const dailyGoals = this.buildDailyGoals(tasks, sessions, problems, user, bounds);

    return {
      pendingRevisionsCount: pending.length,
      pendingRevisions,
      todaysTasks,
      upcomingReminders,
      dailyGoals,
    };
  }

  private buildDailyGoals(
    tasks: (TaskDoc & WithId)[],
    sessions: (StudySessionDoc & WithId)[],
    problems: (ProblemDoc & WithId)[],
    user: UserDoc | null,
    bounds: { startOfDayIso: string; endOfDayIso: string },
  ): DailyGoals {
    const studyMinutesGoal =
      user?.preferences?.dailyStudyGoalMinutes ?? FALLBACK_STUDY_GOAL_MINUTES;
    const problemsGoal = user?.preferences?.dailyProblemGoal ?? FALLBACK_PROBLEM_GOAL;

    const studyMinutesDone = sessions
      .filter((s) => s.startTime >= bounds.startOfDayIso && s.startTime <= bounds.endOfDayIso)
      .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

    const problemsDone = problems.filter(
      (p) =>
        p.dateSolved !== undefined &&
        p.dateSolved >= bounds.startOfDayIso &&
        p.dateSolved <= bounds.endOfDayIso,
    ).length;

    const tasksDone = tasks.filter(
      (t) =>
        t.status === TaskStatus.COMPLETED &&
        t.completedAt !== undefined &&
        t.completedAt >= bounds.startOfDayIso &&
        t.completedAt <= bounds.endOfDayIso,
    ).length;

    return {
      studyMinutesGoal,
      studyMinutesDone,
      problemsGoal,
      problemsDone,
      tasksGoal: FALLBACK_TASKS_GOAL,
      tasksDone,
    };
  }

  private buildQuickStats(
    revisions: (RevisionDoc & WithId)[],
    tasks: (TaskDoc & WithId)[],
    sessions: (StudySessionDoc & WithId)[],
    problems: (ProblemDoc & WithId)[],
    reflections: (ReflectionDoc & WithId)[],
    bounds: { startOfDayIso: string; endOfDayIso: string; todayKey: string },
  ): QuickStats {
    const studyMinutesToday = sessions
      .filter((s) => s.startTime >= bounds.startOfDayIso && s.startTime <= bounds.endOfDayIso)
      .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

    const problemsSolved = problems.filter(
      (p) =>
        p.dateSolved !== undefined &&
        p.dateSolved >= bounds.startOfDayIso &&
        p.dateSolved <= bounds.endOfDayIso,
    ).length;

    const tasksCompleted = tasks.filter(
      (t) =>
        t.status === TaskStatus.COMPLETED &&
        t.completedAt !== undefined &&
        t.completedAt >= bounds.startOfDayIso &&
        t.completedAt <= bounds.endOfDayIso,
    ).length;

    // Revisions whose due-time has elapsed today: completed vs. total surfaced.
    const dueToday = revisions.filter((r) => r.dueAt <= bounds.endOfDayIso);
    const completedToday = dueToday.filter(
      (r) => r.status === RevisionStatus.COMPLETED,
    ).length;
    const revisionCompletionPercent =
      dueToday.length === 0 ? 100 : Math.round((completedToday / dueToday.length) * 100);

    const weeklyProductivityScore = this.computeWeeklyProductivityScore(
      sessions,
      problems,
      tasks,
      reflections,
    );

    return {
      studyHoursToday: round1(studyMinutesToday / 60),
      problemsSolved,
      tasksCompleted,
      revisionCompletionPercent,
      weeklyProductivityScore,
    };
  }

  /**
   * A 0-100 composite of the week's effort: study focus, problems solved,
   * tasks completed and reflection consistency, each capped at a target so a
   * single dimension cannot dominate the score.
   */
  private computeWeeklyProductivityScore(
    sessions: (StudySessionDoc & WithId)[],
    problems: (ProblemDoc & WithId)[],
    tasks: (TaskDoc & WithId)[],
    reflections: (ReflectionDoc & WithId)[],
  ): number {
    const weeklyStudyMinutes = sessions.reduce(
      (sum, s) => sum + (s.durationMinutes ?? 0),
      0,
    );
    const weeklyProblems = problems.length;
    const weeklyTasksDone = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    ).length;
    const reflectionDays = reflections.filter((r) => r.goalsCompleted).length;

    // Targets representing a "strong" week; ratios are clamped to [0, 1].
    const TARGET_STUDY_MINUTES = 600; // ~10 focused hours
    const TARGET_PROBLEMS = 21; // 3/day
    const TARGET_TASKS = 14; // 2/day
    const TARGET_REFLECTION_DAYS = 7;

    const studyRatio = Math.min(weeklyStudyMinutes / TARGET_STUDY_MINUTES, 1);
    const problemRatio = Math.min(weeklyProblems / TARGET_PROBLEMS, 1);
    const taskRatio = Math.min(weeklyTasksDone / TARGET_TASKS, 1);
    const reflectionRatio = Math.min(reflectionDays / TARGET_REFLECTION_DAYS, 1);

    const score =
      studyRatio * 40 + problemRatio * 30 + taskRatio * 20 + reflectionRatio * 10;
    return Math.round(score);
  }

  private buildUpcomingSchedule(
    revisions: (RevisionDoc & WithId)[],
    tasks: (TaskDoc & WithId)[],
    sessions: (StudySessionDoc & WithId)[],
    nowIsoStr: string,
  ): UpcomingScheduleItem[] {
    const items: UpcomingScheduleItem[] = [];

    for (const r of revisions) {
      if (OPEN_REVISION_STATUSES.includes(r.status) && r.dueAt >= nowIsoStr) {
        items.push({
          id: r.id,
          type: 'revision',
          title: r.entityTitle,
          scheduledAt: r.dueAt,
        });
      }
    }

    for (const t of tasks) {
      if (!OPEN_TASK_STATUSES.includes(t.status)) continue;
      const at = t.reminderAt ?? t.dueDate;
      if (at !== undefined && at >= nowIsoStr) {
        items.push({
          id: t.id,
          type: 'task' satisfies DashboardActivityType,
          title: t.title,
          scheduledAt: at,
        });
      }
    }

    for (const s of sessions) {
      if (s.startTime >= nowIsoStr) {
        items.push({
          id: s.id,
          type: 'study_session',
          title: 'Study session',
          scheduledAt: s.startTime,
        });
      }
    }

    items.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return items.slice(0, UPCOMING_SCHEDULE_LIMIT);
  }
}

export const dashboardService = new DashboardService();
