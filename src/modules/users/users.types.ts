import type { UserRole } from '@/constants';
import type { NotificationPreferences } from '@/notifications/notification.types';
import type { BaseEntity } from '@/types';

export type ThemePreference = 'light' | 'dark' | 'system';

/** User study & app preferences. */
export interface UserPreferences {
  theme: ThemePreference;
  /** Target focus minutes per day. */
  dailyStudyGoalMinutes: number;
  /** Target problems to solve per day. */
  dailyProblemGoal: number;
  /** Local hour (0-23) at which daily reminders fire. */
  reminderHour: number;
  /** IANA timezone string, e.g. "Asia/Kolkata". */
  timezone: string;
}

/** The canonical user document (system of record mirror of the Firebase Auth user). */
export interface User extends BaseEntity {
  /** Firebase Auth uid — also the Firestore document id. */
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  role: UserRole;
  emailVerified: boolean;
  preferences: UserPreferences;
  notificationPreferences: NotificationPreferences;
  /** Current consecutive-day study streak. */
  currentStreak: number;
  longestStreak: number;
  /** Day key (YYYY-MM-DD) of the last day the user logged any study activity. */
  lastActiveDay: string | null;
  /** Accumulated experience points from achievements. */
  xp: number;
  lastLoginAt: string | null;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  dailyStudyGoalMinutes: 120,
  dailyProblemGoal: 3,
  reminderHour: 9,
  timezone: 'UTC',
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  categories: {},
};
