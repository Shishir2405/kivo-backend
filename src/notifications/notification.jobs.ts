import { NotificationType } from '@/constants';
import { habitsRepository } from '@/modules/habits';
import { reflectionsRepository } from '@/modules/reflections';
import { studySessionsRepository } from '@/modules/study-sessions';
import { taskRepository } from '@/modules/tasks';
import { userRepository } from '@/modules/users';
import type { User } from '@/modules/users';
import { dayjs, dayKey } from '@/utils/dates';
import { createLogger } from '@/utils/logger';

import { notificationService } from './notification.service';

const log = createLogger('notification-jobs');

/**
 * Fan-out notification jobs. Each runs on a schedule in the worker process and
 * walks every user, deciding per-user whether to send. `notificationService.notify`
 * already honours per-user push prefs, per-category toggles, and quiet hours, so
 * these jobs only decide *eligibility* (e.g. "habit not done today"), never policy.
 *
 * Every send is best-effort and isolated: one user's failure never aborts the sweep.
 */

/** Start of today (local) as an ISO string — used for "since today" activity checks. */
function startOfTodayIso(): string {
  return dayjs().startOf('day').toISOString();
}

async function forEachUser(
  jobName: string,
  handler: (user: User) => Promise<void>,
): Promise<number> {
  const users = await userRepository.listAll();
  let sent = 0;
  for (const user of users) {
    try {
      await handler(user);
      sent += 1;
    } catch (err) {
      log.warn({ err, userId: user.uid, jobName }, 'Per-user notification job step failed');
    }
  }
  log.info({ jobName, users: users.length, processed: sent }, 'Notification sweep complete');
  return sent;
}

/**
 * Remind users about active habits they have not completed today. Honours each
 * habit's `reminderTime` loosely — the daily schedule fires once and we notify for
 * any still-incomplete habit, so a user gets at most one nudge per habit per day.
 */
export async function runHabitReminders(): Promise<number> {
  const today = dayKey();
  return forEachUser('habit_reminder', async (user) => {
    const habits = await habitsRepository.findActive(user.uid);
    for (const habit of habits) {
      const doneToday = habit.lastCompletedDay === today;
      if (doneToday) continue;
      await notificationService.notify(user.uid, NotificationType.HABIT_REMINDER, {
        habitId: habit.id,
        habitName: habit.name,
      });
    }
  });
}

/** Nudge users who have not written today's reflection. */
export async function runReflectionReminders(): Promise<number> {
  const today = dayKey();
  return forEachUser('reflection_reminder', async (user) => {
    const existing = await reflectionsRepository.findByDay(user.uid, today);
    if (existing) return;
    await notificationService.notify(user.uid, NotificationType.REFLECTION_REMINDER, {});
  });
}

/**
 * Daily-goal nudge: a light "what have you done / what's left today" prompt. We
 * count today's study sessions + completed tasks as the day's progress signal.
 */
export async function runDailyGoalReminders(): Promise<number> {
  const since = startOfTodayIso();
  return forEachUser('daily_goal', async (user) => {
    const [sessions, tasks] = await Promise.all([
      studySessionsRepository.findStartedSince(user.uid, since),
      taskRepository.findCompletedSince(user.uid, since),
    ]);
    const completed = sessions.length + tasks.length;
    await notificationService.notify(user.uid, NotificationType.DAILY_GOAL, {
      goalsCompleted: completed,
      // No fixed daily target in the model; surface completed-today as both so the
      // template renders a sensible "you've done N today" message.
      goalsTotal: completed,
    });
  });
}

/**
 * Streak-warning sweep: a user with an active streak who has not been active today
 * is at risk of losing it. `lastActiveDay`/`currentStreak` are maintained by the
 * streak recalculation job. (Also invoked inline by RECALCULATE_STREAKS.)
 */
export async function runStreakWarnings(): Promise<number> {
  const today = dayKey();
  return forEachUser('streak_warning', async (user) => {
    if (user.currentStreak <= 0) return;
    if (user.lastActiveDay === today) return; // already active today — safe
    await notificationService.notify(user.uid, NotificationType.STREAK_WARNING, {
      streakDays: user.currentStreak,
    });
  });
}

/** Re-engage users who have been inactive for `thresholdDays` or more. */
export async function runInactivityReminders(thresholdDays = 3): Promise<number> {
  const now = dayjs();
  return forEachUser('inactivity_reminder', async (user) => {
    if (!user.lastActiveDay) return; // never active — skip rather than spam new signups
    const daysInactive = now.diff(dayjs(user.lastActiveDay, 'YYYY-MM-DD'), 'day');
    if (daysInactive < thresholdDays) return;
    await notificationService.notify(user.uid, NotificationType.INACTIVITY_REMINDER, {
      daysInactive,
    });
  });
}

/** Send a monthly summary to every user (the 1st of each month). */
export async function runMonthlySummaries(): Promise<number> {
  const month = dayjs().subtract(1, 'day').format('MMMM YYYY'); // the month that just ended
  return forEachUser('monthly_summary', async (user) => {
    await notificationService.notify(user.uid, NotificationType.MONTHLY_SUMMARY, {
      month,
    });
  });
}
