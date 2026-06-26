import type { NotificationStatus, NotificationType } from '@/constants';
import type { BaseEntity } from '@/types';

/** A persisted notification record (history + delivery status). */
export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Arbitrary structured payload delivered alongside the push (deep-link ids etc). */
  data: Record<string, string>;
  status: NotificationStatus;
  /** Whether the user has opened/read it in-app. */
  read: boolean;
  readAt?: string;
  sentAt?: string;
  failureReason?: string;
}

export type DeviceTokenPlatform = 'ios' | 'android' | 'web';

/** A registered FCM device token for push delivery. */
export interface DeviceToken extends BaseEntity {
  userId: string;
  token: string;
  platform: DeviceTokenPlatform;
  /** Optional device label for the user's device list. */
  deviceName?: string;
  lastUsedAt: string;
}

/** Built notification payload (title/body/data) produced by the template factory. */
export interface NotificationContent {
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Quiet-hours window (local 24h hours) during which non-urgent pushes are suppressed. */
export interface QuietHours {
  enabled: boolean;
  /** 0-23 */
  startHour: number;
  /** 0-23 */
  endHour: number;
}

/** Per-category notification toggles, keyed loosely so new categories don't break reads. */
export interface NotificationPreferences {
  pushEnabled: boolean;
  quietHours: QuietHours;
  categories: Partial<Record<NotificationType, boolean>>;
}
