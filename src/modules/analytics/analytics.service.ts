import type { DocumentData, Query } from 'firebase-admin/firestore';

import {
  Collections,
  ProblemStatus,
  RevisionStatus,
  TaskStatus,
} from '@/constants';
import { collection } from '@/firebase/firestore';
import type { DsaProblem } from '@/modules/dsa/dsa.types';
import type { Revision } from '@/modules/revisions/revisions.types';
import type { Task } from '@/modules/tasks/tasks.types';
import type { CreateInput } from '@/types';
import { addDays, dayKey, dayjs, nowIso, startOfIsoWeek } from '@/utils/dates';

import type {
  ContributionBreakdown,
  HabitDoc,
  HeatmapCell,
  HeatmapRange,
  HeatmapResult,
  StreaksResult,
  StudySessionDoc,
  TopicMetric,
  WeeklyReport,
} from './analytics.types';

/** Number of days each fixed heatmap range spans. */
const RANGE_DAYS: Record<Exclude<HeatmapRange, 'lifetime'>, number> = {
  '30': 30,
  '90': 90,
  '365': 365,
};

/** Earliest day we will ever scan for the "lifetime" range (defensive bound). */
const LIFETIME_MAX_DAYS = 365 * 5;

function emptyBreakdown(): ContributionBreakdown {
  return {
    studySessions: 0,
    problemsSolved: 0,
    revisionsCompleted: 0,
    tasksCompleted: 0,
    habitCompletions: 0,
  };
}

/** Best-effort extraction of a day key from an ISO timestamp; null if absent/invalid. */
function dayKeyOf(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = dayjs(iso);
  return d.isValid() ? d.format('YYYY-MM-DD') : null;
}

export class AnalyticsService {
  // ── direct collection accessors (read-only aggregation) ────────────────────

  private studySessions(userId: string): Query<DocumentData> {
    return collection(Collections.STUDY_SESSIONS).where('userId', '==', userId);
  }

  private problems(userId: string): Query<DocumentData> {
    return collection(Collections.PROBLEMS).where('userId', '==', userId);
  }

  private revisions(userId: string): Query<DocumentData> {
    return collection(Collections.REVISIONS).where('userId', '==', userId);
  }

  private tasks(userId: string): Query<DocumentData> {
    return collection(Collections.TASKS).where('userId', '==', userId);
  }

  private habits(userId: string): Query<DocumentData> {
    return collection(Collections.HABITS).where('userId', '==', userId);
  }

  private async readAll<T>(query: Query<DocumentData>): Promise<T[]> {
    const snap = await query.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<T, 'id'>) }) as T);
  }

  // ── Heatmap ────────────────────────────────────────────────────────────────

  /**
   * Per-day-key contribution counts aggregated across study sessions, problems
   * solved, revisions completed, tasks completed, and habit completions.
   */
  async getHeatmap(userId: string, range: HeatmapRange): Promise<HeatmapResult> {
    const todayKey = dayKey();
    const windowDays = range === 'lifetime' ? LIFETIME_MAX_DAYS : RANGE_DAYS[range];
    const startKey = dayKey(addDays(-(windowDays - 1)));

    const [sessions, problems, revisions, tasks, habits] = await Promise.all([
      this.readAll<StudySessionDoc>(this.studySessions(userId)),
      this.readAll<DsaProblem>(this.problems(userId)),
      this.readAll<Revision>(this.revisions(userId)),
      this.readAll<Task>(this.tasks(userId)),
      this.readAll<HabitDoc>(this.habits(userId)),
    ]);

    const cells = new Map<string, ContributionBreakdown>();
    const bump = (key: string | null, field: keyof ContributionBreakdown): void => {
      if (!key || key < startKey || key > todayKey) return;
      const cell = cells.get(key) ?? emptyBreakdown();
      cell[field] += 1;
      cells.set(key, cell);
    };

    for (const s of sessions) {
      bump(dayKeyOf(s.completedAt ?? s.startedAt ?? s.createdAt), 'studySessions');
    }
    for (const p of problems) {
      if (p.status === ProblemStatus.COMPLETED || p.isCompleted) {
        bump(dayKeyOf(p.dateSolved ?? p.updatedAt), 'problemsSolved');
      }
    }
    for (const r of revisions) {
      if (r.status === RevisionStatus.COMPLETED) {
        bump(dayKeyOf(r.completedAt ?? r.updatedAt), 'revisionsCompleted');
      }
    }
    for (const t of tasks) {
      if (t.status === TaskStatus.COMPLETED) {
        bump(dayKeyOf(t.completedAt ?? t.updatedAt), 'tasksCompleted');
      }
    }
    for (const h of habits) {
      for (const d of h.completedDates ?? []) {
        bump(d, 'habitCompletions');
      }
    }

    const orderedCells: HeatmapCell[] = [...cells.entries()]
      .map(([date, breakdown]) => ({
        date,
        count:
          breakdown.studySessions +
          breakdown.problemsSolved +
          breakdown.revisionsCompleted +
          breakdown.tasksCompleted +
          breakdown.habitCompletions,
        breakdown,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalContributions = orderedCells.reduce((sum, c) => sum + c.count, 0);

    return {
      range,
      startDate: startKey,
      endDate: todayKey,
      totalContributions,
      activeDays: orderedCells.length,
      cells: orderedCells,
    };
  }

  // ── Streaks ──────────────────────────────────────────────────────────────────

  /**
   * Daily/weekly/longest study streaks. An "active" day is any day with study
   * activity (study sessions, problems solved, revisions completed, tasks
   * completed, or habit completions), reusing the heatmap aggregation.
   */
  async getStreaks(userId: string): Promise<StreaksResult> {
    const heatmap = await this.getHeatmap(userId, 'lifetime');
    const activeKeys = heatmap.cells.map((c) => c.date).sort();

    if (activeKeys.length === 0) {
      return {
        currentDailyStreak: 0,
        longestDailyStreak: 0,
        currentWeeklyStreak: 0,
        longestWeeklyStreak: 0,
      };
    }

    const activeSet = new Set(activeKeys);
    const lastActiveDate = activeKeys[activeKeys.length - 1] as string;

    // ── Longest daily streak (scan ordered keys) ──
    let longestDailyStreak = 1;
    let run = 1;
    for (let i = 1; i < activeKeys.length; i += 1) {
      const prev = activeKeys[i - 1] as string;
      const curr = activeKeys[i] as string;
      if (dayKey(addDays(1, prev)) === curr) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > longestDailyStreak) longestDailyStreak = run;
    }

    // ── Current daily streak (walk back from today; allow today-not-yet-active) ──
    const todayKey = dayKey();
    let cursor = activeSet.has(todayKey) ? todayKey : dayKey(addDays(-1));
    let currentDailyStreak = 0;
    let streakStartDate: string | undefined;
    while (activeSet.has(cursor)) {
      currentDailyStreak += 1;
      streakStartDate = cursor;
      cursor = dayKey(addDays(-1, cursor));
    }

    // ── Weekly streaks (bucket active days into ISO-week starts) ──
    const activeWeeks = new Set(activeKeys.map((k) => startOfIsoWeek(k)));
    const orderedWeeks = [...activeWeeks].sort();

    let longestWeeklyStreak = orderedWeeks.length > 0 ? 1 : 0;
    let weekRun = orderedWeeks.length > 0 ? 1 : 0;
    for (let i = 1; i < orderedWeeks.length; i += 1) {
      const prevWeek = orderedWeeks[i - 1] as string;
      const currWeek = orderedWeeks[i] as string;
      if (startOfIsoWeek(addDays(7, prevWeek)) === currWeek) {
        weekRun += 1;
      } else {
        weekRun = 1;
      }
      if (weekRun > longestWeeklyStreak) longestWeeklyStreak = weekRun;
    }

    const thisWeek = startOfIsoWeek();
    let weekCursor = activeWeeks.has(thisWeek) ? thisWeek : startOfIsoWeek(addDays(-7));
    let currentWeeklyStreak = 0;
    while (activeWeeks.has(weekCursor)) {
      currentWeeklyStreak += 1;
      weekCursor = startOfIsoWeek(addDays(-7, weekCursor));
    }

    const result: StreaksResult = {
      currentDailyStreak,
      longestDailyStreak,
      currentWeeklyStreak,
      longestWeeklyStreak,
      lastActiveDate,
    };
    if (streakStartDate !== undefined) result.streakStartDate = streakStartDate;
    return result;
  }

  // ── Weekly report ─────────────────────────────────────────────────────────────

  /**
   * Compute (and persist) a weekly report for the ISO week containing
   * `weekStartIso` (defaults to the current week).
   */
  async getWeeklyReport(userId: string, weekStartIso?: string): Promise<WeeklyReport> {
    const weekStart = startOfIsoWeek(weekStartIso ?? nowIso());
    const weekEnd = addDays(7, weekStart);

    const inWindow = (iso: string | undefined): boolean =>
      iso !== undefined && iso >= weekStart && iso < weekEnd;

    const [sessions, problems, revisions, tasks, habits] = await Promise.all([
      this.readAll<StudySessionDoc>(this.studySessions(userId)),
      this.readAll<DsaProblem>(this.problems(userId)),
      this.readAll<Revision>(this.revisions(userId)),
      this.readAll<Task>(this.tasks(userId)),
      this.readAll<HabitDoc>(this.habits(userId)),
    ]);

    // ── Study sessions / focus ──
    const weekSessions = sessions.filter((s) =>
      inWindow(s.completedAt ?? s.startedAt ?? s.createdAt),
    );
    const totalStudyMinutes = weekSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
    const focusSessions = weekSessions.filter((s) => s.isCompleted !== false).length;
    const longestSessionMinutes = weekSessions.reduce(
      (max, s) => Math.max(max, s.durationMinutes ?? 0),
      0,
    );
    const studyHours = Math.round((totalStudyMinutes / 60) * 10) / 10;

    // ── Problems solved ──
    const weekProblems = problems.filter(
      (p) =>
        (p.status === ProblemStatus.COMPLETED || p.isCompleted) &&
        inWindow(p.dateSolved ?? p.updatedAt),
    );
    const problemsSolved = weekProblems.length;

    // ── Topics completed (from completed DSA topics) ──
    const topics = await this.readAll<{ id: string; completedAt?: string; isCompleted?: boolean }>(
      collection(Collections.DSA_TOPICS).where('userId', '==', userId),
    );
    const topicsCompleted = topics.filter(
      (t) => t.isCompleted && inWindow(t.completedAt),
    ).length;

    // ── Revision completion rate (revisions due this week) ──
    const dueRevisions = revisions.filter((r) => inWindow(r.dueAt));
    const completedRevisions = dueRevisions.filter(
      (r) => r.status === RevisionStatus.COMPLETED,
    ).length;
    const revisionCompletionRate = this.rate(completedRevisions, dueRevisions.length);

    // ── Task completion rate (tasks due this week) ──
    const dueTasks = tasks.filter((t) => inWindow(t.dueDate));
    const completedTasks = dueTasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const taskCompletionRate = this.rate(completedTasks, dueTasks.length);

    // ── Habit completion rate (active habits × 7 days) ──
    const habitCompletionRate = this.computeHabitRate(habits, weekStart);

    // ── Strongest / weakest topic (by problems solved, tie-broken by minutes) ──
    const { strongest, weakest } = this.topicExtremes(weekProblems, weekSessions);

    // ── Productivity score ──
    const productivityScore = this.productivityScore({
      studyHours,
      problemsSolved,
      revisionCompletionRate,
      taskCompletionRate,
      habitCompletionRate,
      focusSessions,
    });

    const recommendations = this.buildRecommendations({
      studyHours,
      problemsSolved,
      revisionCompletionRate,
      taskCompletionRate,
      habitCompletionRate,
      focusSessions,
      weakest,
    });

    const payload: CreateInput<WeeklyReport> = {
      userId,
      weekStart,
      weekEnd,
      studyHours,
      problemsSolved,
      topicsCompleted,
      revisionCompletionRate,
      taskCompletionRate,
      focusSessions,
      habitCompletionRate,
      longestSessionMinutes,
      productivityScore,
      recommendations,
    };
    if (strongest) payload.strongestTopic = strongest;
    if (weakest) payload.weakestTopic = weakest;

    return this.persistWeeklyReport(userId, weekStart, payload);
  }

  // ── batch jobs (consumed by the analytics queue) ───────────────────────────────

  /**
   * Generate and persist the current week's report for one user (when `userId`
   * is given) or for every user. Returns the number of reports written.
   */
  async generateWeeklyReports(userId?: string): Promise<number> {
    const userIds = userId ? [userId] : await this.allUserIds();
    let count = 0;
    for (const uid of userIds) {
      await this.getWeeklyReport(uid);
      count += 1;
    }
    return count;
  }

  /**
   * Recompute and persist streak stats for one user (when `userId` is given) or
   * for every user. Returns the number of users processed.
   */
  async recalculateStreaks(userId?: string): Promise<number> {
    const userIds = userId ? [userId] : await this.allUserIds();
    let count = 0;
    for (const uid of userIds) {
      const streaks = await this.getStreaks(uid);
      await this.persistStreaks(uid, streaks);
      count += 1;
    }
    return count;
  }

  // ── internals ────────────────────────────────────────────────────────────────

  /** All registered user ids (used by batch jobs that fan out across users). */
  private async allUserIds(): Promise<string[]> {
    const snap = await collection(Collections.USERS).get();
    return snap.docs.map((d) => d.id);
  }

  /** Persist the latest streak snapshot under a deterministic per-user doc. */
  private async persistStreaks(userId: string, streaks: StreaksResult): Promise<void> {
    const ref = collection(Collections.ANALYTICS).doc(`${userId}_streaks`);
    const existing = await ref.get();
    const ts = nowIso();
    const createdAt = existing.exists
      ? ((existing.data() as { createdAt?: string }).createdAt ?? ts)
      : ts;
    await ref.set({ userId, ...streaks, createdAt, updatedAt: ts }, { merge: false });
  }

  /** Upsert the weekly report keyed deterministically by user + week. */
  private async persistWeeklyReport(
    userId: string,
    weekStart: string,
    payload: CreateInput<WeeklyReport>,
  ): Promise<WeeklyReport> {
    const docId = `${userId}_${dayKey(weekStart)}`;
    const ref = collection(Collections.ANALYTICS).doc(docId);
    const existing = await ref.get();
    const ts = nowIso();
    const createdAt = existing.exists
      ? ((existing.data() as { createdAt?: string }).createdAt ?? ts)
      : ts;
    const doc = { ...payload, createdAt, updatedAt: ts };
    await ref.set(doc, { merge: false });
    return { id: ref.id, ...doc } as WeeklyReport;
  }

  /** Percentage helper: 0 when there is nothing due. */
  private rate(completed: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((completed / total) * 100);
  }

  /** Habit completion rate = completions in week / (active habits × 7), capped at 100. */
  private computeHabitRate(habits: HabitDoc[], weekStart: string): number {
    const active = habits.filter((h) => !h.isArchived);
    if (active.length === 0) return 0;
    const weekDayKeys = new Set<string>();
    for (let i = 0; i < 7; i += 1) {
      weekDayKeys.add(dayKey(addDays(i, weekStart)));
    }
    let completions = 0;
    for (const h of active) {
      for (const d of h.completedDates ?? []) {
        if (weekDayKeys.has(d)) completions += 1;
      }
    }
    return this.rate(completions, active.length * 7);
  }

  /** Determine the strongest and weakest topics within the week. */
  private topicExtremes(
    weekProblems: DsaProblem[],
    weekSessions: StudySessionDoc[],
  ): { strongest?: TopicMetric; weakest?: TopicMetric } {
    const byTopic = new Map<string, TopicMetric>();
    const ensure = (topicId: string, title: string): TopicMetric => {
      const existing = byTopic.get(topicId);
      if (existing) {
        if (existing.topicTitle === topicId && title !== topicId) existing.topicTitle = title;
        return existing;
      }
      const metric: TopicMetric = {
        topicId,
        topicTitle: title,
        problemsSolved: 0,
        studyMinutes: 0,
      };
      byTopic.set(topicId, metric);
      return metric;
    };

    for (const p of weekProblems) {
      if (!p.topicId) continue;
      ensure(p.topicId, p.topicId).problemsSolved += 1;
    }
    for (const s of weekSessions) {
      if (!s.topicId) continue;
      const metric = ensure(s.topicId, s.topicTitle ?? s.topicId);
      metric.studyMinutes += s.durationMinutes ?? 0;
    }

    const metrics = [...byTopic.values()];
    if (metrics.length === 0) return {};

    const score = (m: TopicMetric): number => m.problemsSolved * 1000 + m.studyMinutes;
    const sorted = [...metrics].sort((a, b) => score(b) - score(a));
    const strongest = sorted[0];
    const weakest = sorted[sorted.length - 1];

    const result: { strongest?: TopicMetric; weakest?: TopicMetric } = {};
    if (strongest) result.strongest = strongest;
    if (weakest && weakest !== strongest) result.weakest = weakest;
    return result;
  }

  /**
   * Composite 0-100 productivity score. Weighted blend of study volume,
   * problem throughput, completion rates and focus consistency.
   */
  private productivityScore(input: {
    studyHours: number;
    problemsSolved: number;
    revisionCompletionRate: number;
    taskCompletionRate: number;
    habitCompletionRate: number;
    focusSessions: number;
  }): number {
    // Normalise each signal to 0-100 against a "healthy week" target.
    const studyScore = Math.min(100, (input.studyHours / 14) * 100); // ~2h/day
    const problemScore = Math.min(100, (input.problemsSolved / 14) * 100); // ~2/day
    const focusScore = Math.min(100, (input.focusSessions / 14) * 100); // ~2 sessions/day

    const composite =
      studyScore * 0.25 +
      problemScore * 0.2 +
      input.revisionCompletionRate * 0.2 +
      input.taskCompletionRate * 0.15 +
      input.habitCompletionRate * 0.1 +
      focusScore * 0.1;

    return Math.round(Math.min(100, Math.max(0, composite)));
  }

  /** Generate actionable, deterministic recommendations from the week's metrics. */
  private buildRecommendations(input: {
    studyHours: number;
    problemsSolved: number;
    revisionCompletionRate: number;
    taskCompletionRate: number;
    habitCompletionRate: number;
    focusSessions: number;
    weakest?: TopicMetric;
  }): string[] {
    const recs: string[] = [];

    if (input.studyHours < 7) {
      recs.push('Aim for at least 1 hour of focused study per day to build momentum.');
    }
    if (input.focusSessions < 5) {
      recs.push('Schedule more focus sessions — short, consistent blocks beat long cramming.');
    }
    if (input.problemsSolved < 7) {
      recs.push('Try to solve at least one problem a day to keep your skills sharp.');
    }
    if (input.revisionCompletionRate < 70) {
      recs.push('Your revision completion is slipping — clear due revisions before they pile up.');
    }
    if (input.taskCompletionRate < 70) {
      recs.push('Break larger tasks into smaller steps to lift your task completion rate.');
    }
    if (input.habitCompletionRate < 70) {
      recs.push('Reconnect with your habits — even a 5-minute check-in keeps the streak alive.');
    }
    if (input.weakest) {
      recs.push(
        `Spend extra time on "${input.weakest.topicTitle}" — it's your weakest area this week.`,
      );
    }
    if (recs.length === 0) {
      recs.push('Great week! Keep your momentum going and consider raising your targets.');
    }
    return recs;
  }
}

export const analyticsService = new AnalyticsService();
