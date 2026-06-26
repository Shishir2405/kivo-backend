import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { dayjs, dayKey, nowIso } from '@/utils/dates';

import { habitsRepository } from './habits.repository';
import type {
  Habit,
  HabitCompletion,
  HabitHistoryEntry,
  HabitStats,
  HabitWithStats,
} from './habits.types';
import type {
  CompleteHabitInput,
  CreateHabitInput,
  ListHabitsQuery,
  UpdateHabitInput,
} from './habits.validator';

/** How many trailing days of history to surface in the stats payload. */
const HISTORY_WINDOW_DAYS = 90;

/** Index a habit's completion log by day key for O(1) lookups. */
function indexCompletions(completions: HabitCompletion[]): Map<string, HabitCompletion> {
  const byDay = new Map<string, HabitCompletion>();
  for (const c of completions) byDay.set(c.dayKey, c);
  return byDay;
}

/** Whether a given day met the habit's per-period target. */
function dayMetTarget(completion: HabitCompletion | undefined, target: number): boolean {
  return (completion?.count ?? 0) >= target;
}

/**
 * Current streak = consecutive on-target days ending today (or yesterday, so an
 * untouched-but-unbroken streak survives until the day fully lapses).
 */
function computeCurrentStreak(byDay: Map<string, HabitCompletion>, target: number): number {
  const today = dayjs.utc().startOf('day');
  let cursor = dayMetTarget(byDay.get(today.format('YYYY-MM-DD')), target)
    ? today
    : today.subtract(1, 'day');

  let streak = 0;
  while (dayMetTarget(byDay.get(cursor.format('YYYY-MM-DD')), target)) {
    streak += 1;
    cursor = cursor.subtract(1, 'day');
  }
  return streak;
}

/** Longest run of consecutive on-target days across the whole log. */
function computeLongestStreak(byDay: Map<string, HabitCompletion>, target: number): number {
  const metDays = [...byDay.values()]
    .filter((c) => c.count >= target)
    .map((c) => c.dayKey)
    .sort();

  let longest = 0;
  let run = 0;
  let prev: ReturnType<typeof dayjs> | null = null;

  for (const key of metDays) {
    const day = dayjs.utc(key, 'YYYY-MM-DD');
    if (prev && day.diff(prev, 'day') === 1) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = day;
  }
  return longest;
}

/** Trailing-window history with per-day completion flags, newest first. */
function buildHistory(
  byDay: Map<string, HabitCompletion>,
  target: number,
): HabitHistoryEntry[] {
  const history: HabitHistoryEntry[] = [];
  const today = dayjs.utc().startOf('day');
  for (let i = 0; i < HISTORY_WINDOW_DAYS; i += 1) {
    const key = today.subtract(i, 'day').format('YYYY-MM-DD');
    const count = byDay.get(key)?.count ?? 0;
    history.push({ dayKey: key, count, completed: count >= target });
  }
  return history;
}

function computeStats(habit: Habit): HabitStats {
  const byDay = indexCompletions(habit.completions);
  const todayKey = dayKey();
  return {
    currentStreak: computeCurrentStreak(byDay, habit.targetPerPeriod),
    longestStreak: computeLongestStreak(byDay, habit.targetPerPeriod),
    totalCompletions: habit.totalCompletions,
    completedToday: dayMetTarget(byDay.get(todayKey), habit.targetPerPeriod),
    history: buildHistory(byDay, habit.targetPerPeriod),
  };
}

/** Attach freshly-computed stats to a habit for API responses. */
function withStats(habit: Habit): HabitWithStats {
  return { ...habit, stats: computeStats(habit) };
}

export class HabitsService {
  async create(userId: string, input: CreateHabitInput): Promise<HabitWithStats> {
    const payload: CreateInput<Habit> = {
      userId,
      name: input.name,
      emoji: input.emoji,
      color: input.color,
      frequency: input.frequency,
      daysOfWeek: input.daysOfWeek,
      targetPerPeriod: input.targetPerPeriod,
      completions: [],
      currentStreak: 0,
      longestStreak: 0,
      totalCompletions: 0,
      isArchived: input.isArchived,
    };
    if (input.reminderTime !== undefined) payload.reminderTime = input.reminderTime;
    const habit = await habitsRepository.create(payload);
    return withStats(habit);
  }

  async list(userId: string, query: ListHabitsQuery): Promise<PaginatedResult<HabitWithStats>> {
    const filters = [];
    if (query.frequency) {
      filters.push({ field: 'frequency', op: '==' as const, value: query.frequency });
    }
    filters.push({
      field: 'isArchived',
      op: '==' as const,
      value: query.archived ?? false,
    });
    const result = await habitsRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { filters, orderBy: { field: 'createdAt', direction: 'desc' } },
    );
    return { ...result, items: result.items.map(withStats) };
  }

  async getById(userId: string, id: string): Promise<HabitWithStats> {
    const habit = await habitsRepository.findByIdForUser(id, userId);
    if (!habit) throw ApiError.notFound('Habit not found');
    return withStats(habit);
  }

  async update(userId: string, id: string, input: UpdateHabitInput): Promise<HabitWithStats> {
    const existing = await habitsRepository.findByIdForUser(id, userId);
    if (!existing) throw ApiError.notFound('Habit not found');

    const patch: Partial<Habit> = { ...input };
    // Re-baseline streaks if the target changed, since the threshold shifted.
    if (input.targetPerPeriod !== undefined && input.targetPerPeriod !== existing.targetPerPeriod) {
      const byDay = indexCompletions(existing.completions);
      patch.currentStreak = computeCurrentStreak(byDay, input.targetPerPeriod);
      patch.longestStreak = computeLongestStreak(byDay, input.targetPerPeriod);
    }

    const updated = await habitsRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Habit not found');
    return withStats(updated);
  }

  /** Log a completion for a day, recompute streaks, and persist. */
  async complete(
    userId: string,
    id: string,
    input: CompleteHabitInput,
  ): Promise<HabitWithStats> {
    const habit = await habitsRepository.findByIdForUser(id, userId);
    if (!habit) throw ApiError.notFound('Habit not found');

    const targetDay = input.dayKey ?? dayKey();
    const byDay = indexCompletions(habit.completions);
    const existing = byDay.get(targetDay);
    const now = nowIso();

    byDay.set(targetDay, {
      dayKey: targetDay,
      count: (existing?.count ?? 0) + input.count,
      completedAt: now,
    });

    const patch = this.recalculate(habit, byDay, {
      totalCompletionsDelta: input.count,
    });
    patch.lastCompletedDay = this.latestDay(byDay) ?? targetDay;

    const updated = await habitsRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Habit not found');
    return withStats(updated);
  }

  /** Remove a day's completions (or decrement them), recompute streaks, and persist. */
  async uncomplete(
    userId: string,
    id: string,
    input: CompleteHabitInput,
  ): Promise<HabitWithStats> {
    const habit = await habitsRepository.findByIdForUser(id, userId);
    if (!habit) throw ApiError.notFound('Habit not found');

    const targetDay = input.dayKey ?? dayKey();
    const byDay = indexCompletions(habit.completions);
    const existing = byDay.get(targetDay);
    if (!existing) throw ApiError.badRequest('No completion logged for that day');

    const removed = Math.min(existing.count, input.count);
    const remaining = existing.count - removed;
    if (remaining <= 0) {
      byDay.delete(targetDay);
    } else {
      byDay.set(targetDay, { ...existing, count: remaining });
    }

    const patch = this.recalculate(habit, byDay, {
      totalCompletionsDelta: -removed,
    });
    patch.lastCompletedDay = this.latestDay(byDay);

    const updated = await habitsRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Habit not found');
    return withStats(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    const habit = await habitsRepository.findByIdForUser(id, userId);
    if (!habit) throw ApiError.notFound('Habit not found');
    await habitsRepository.delete(id);
  }

  /** Build the persisted patch (completions + denormalised streak counters). */
  private recalculate(
    habit: Habit,
    byDay: Map<string, HabitCompletion>,
    opts: { totalCompletionsDelta: number },
  ): Partial<Habit> {
    const completions = [...byDay.values()].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
    const currentStreak = computeCurrentStreak(byDay, habit.targetPerPeriod);
    const longestStreak = Math.max(
      habit.longestStreak,
      computeLongestStreak(byDay, habit.targetPerPeriod),
    );
    const totalCompletions = Math.max(0, habit.totalCompletions + opts.totalCompletionsDelta);
    return { completions, currentStreak, longestStreak, totalCompletions };
  }

  /** Most recent day key present in the log, or undefined when empty. */
  private latestDay(byDay: Map<string, HabitCompletion>): string | undefined {
    let latest: string | undefined;
    for (const key of byDay.keys()) {
      if (latest === undefined || key > latest) latest = key;
    }
    return latest;
  }
}

export const habitsService = new HabitsService();
