import { NotificationType } from '@/constants';

import type { NotificationContent } from './notification.types';

/**
 * Strongly-typed payload shapes per notification type. Every `NotificationType`
 * is represented so the `buildNotification` factory is exhaustive.
 */
export interface NotificationDataMap {
  [NotificationType.REVISION_REMINDER]: {
    revisionId: string;
    entityTitle: string;
    entityType?: string;
    dueAt?: string;
  };
  [NotificationType.DAILY_GOAL]: {
    goalsCompleted?: number;
    goalsTotal?: number;
  };
  [NotificationType.STUDY_TIMER_COMPLETE]: {
    sessionId: string;
    durationMinutes: number;
    topicTitle?: string;
  };
  [NotificationType.HABIT_REMINDER]: {
    habitId: string;
    habitName: string;
  };
  [NotificationType.REFLECTION_REMINDER]: Record<string, never>;
  [NotificationType.WEEKLY_ANALYTICS]: {
    weekStart?: string;
    productivityScore?: number;
    problemsSolved?: number;
  };
  [NotificationType.MONTHLY_SUMMARY]: {
    month?: string;
    productivityScore?: number;
  };
  [NotificationType.ACHIEVEMENT_UNLOCKED]: {
    achievementId: string;
    achievementName: string;
  };
  [NotificationType.STREAK_WARNING]: {
    streakDays: number;
  };
  [NotificationType.INACTIVITY_REMINDER]: {
    daysInactive?: number;
  };
  [NotificationType.CUSTOM]: {
    title: string;
    body: string;
    [key: string]: string;
  };
}

/** Flatten a structured data object into FCM's string-only data map. */
function toStringMap(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === 'string' ? value : String(value);
  }
  return out;
}

/**
 * Notification copy factory. Returns `{ title, body, data }` for every notification
 * type using the PRD's example copy where specified. `data` always carries the
 * notification `type` plus any deep-link context.
 */
export function buildNotification<T extends NotificationType>(
  type: T,
  data: NotificationDataMap[T],
): NotificationContent {
  const content = renderContent(type, data);
  return {
    title: content.title,
    body: content.body,
    data: { type, ...toStringMap(data as Record<string, unknown>), ...content.extraData },
  };
}

interface RenderedCopy {
  title: string;
  body: string;
  extraData?: Record<string, string>;
}

function renderContent<T extends NotificationType>(
  type: T,
  data: NotificationDataMap[T],
): RenderedCopy {
  switch (type) {
    case NotificationType.REVISION_REMINDER: {
      const d = data as NotificationDataMap[typeof NotificationType.REVISION_REMINDER];
      return {
        title: 'Revision due',
        // PRD example copy: "Your Graph revision is due today."
        body: `Your ${d.entityTitle} revision is due today.`,
      };
    }
    case NotificationType.DAILY_GOAL: {
      const d = data as NotificationDataMap[typeof NotificationType.DAILY_GOAL];
      const body =
        d.goalsCompleted !== undefined && d.goalsTotal !== undefined
          ? `You've completed ${d.goalsCompleted} of ${d.goalsTotal} goals today. Keep going!`
          : "Here are your goals for today. Let's get started!";
      return { title: 'Daily goals', body };
    }
    case NotificationType.STUDY_TIMER_COMPLETE: {
      const d = data as NotificationDataMap[typeof NotificationType.STUDY_TIMER_COMPLETE];
      const focus = d.topicTitle ? ` on ${d.topicTitle}` : '';
      return {
        title: 'Focus session complete',
        body: `Nice work! You focused for ${d.durationMinutes} minutes${focus}.`,
      };
    }
    case NotificationType.HABIT_REMINDER: {
      const d = data as NotificationDataMap[typeof NotificationType.HABIT_REMINDER];
      return {
        title: 'Habit reminder',
        body: `Don't forget to complete "${d.habitName}" today.`,
      };
    }
    case NotificationType.REFLECTION_REMINDER: {
      return {
        title: 'Evening reflection',
        // PRD example copy: "Time for your evening reflection."
        body: 'Time for your evening reflection.',
      };
    }
    case NotificationType.WEEKLY_ANALYTICS: {
      const d = data as NotificationDataMap[typeof NotificationType.WEEKLY_ANALYTICS];
      const score =
        d.productivityScore !== undefined
          ? ` Your productivity score was ${d.productivityScore}.`
          : '';
      return {
        title: 'Your weekly report is ready',
        body: `Here's how your week went.${score}`,
      };
    }
    case NotificationType.MONTHLY_SUMMARY: {
      const d = data as NotificationDataMap[typeof NotificationType.MONTHLY_SUMMARY];
      const label = d.month ? ` for ${d.month}` : '';
      return {
        title: 'Your monthly summary',
        body: `Your learning summary${label} is ready to review.`,
      };
    }
    case NotificationType.ACHIEVEMENT_UNLOCKED: {
      const d = data as NotificationDataMap[typeof NotificationType.ACHIEVEMENT_UNLOCKED];
      return {
        title: 'Achievement unlocked!',
        body: `You earned "${d.achievementName}". 🎉`,
      };
    }
    case NotificationType.STREAK_WARNING: {
      const d = data as NotificationDataMap[typeof NotificationType.STREAK_WARNING];
      return {
        title: 'Keep your streak alive',
        // PRD example copy: "You've maintained a 15-day streak."
        body: `You've maintained a ${d.streakDays}-day streak. Study today to keep it going!`,
      };
    }
    case NotificationType.INACTIVITY_REMINDER: {
      const d = data as NotificationDataMap[typeof NotificationType.INACTIVITY_REMINDER];
      const days = d.daysInactive ? ` It's been ${d.daysInactive} days.` : '';
      return {
        title: 'We miss you',
        body: `Ready to get back to learning?${days}`,
      };
    }
    case NotificationType.CUSTOM: {
      const d = data as NotificationDataMap[typeof NotificationType.CUSTOM];
      return { title: d.title, body: d.body };
    }
    default: {
      // Exhaustiveness guard — unreachable if every NotificationType is handled.
      const _exhaustive: never = type;
      return { title: 'Kivo', body: String(_exhaustive) };
    }
  }
}
