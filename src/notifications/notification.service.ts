import { NotificationStatus, NotificationType } from '@/constants';
import { collection } from '@/firebase/firestore';
import { Collections } from '@/constants';
import { enqueueSendPush } from '@/jobs/queues';
import { emitNotificationNew } from '@/socket';
import type { CreateInput, PaginatedResult, PaginationParams } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { createLogger } from '@/utils/logger';

import { sendToUser } from './fcm';
import { notificationRepository } from './notification.repository';
import type {
  Notification,
  NotificationContent,
  NotificationPreferences,
  QuietHours,
} from './notification.types';
import { buildNotification, type NotificationDataMap } from './templates';

const log = createLogger('notification-service');

/** Notification types that always send, ignoring quiet hours. */
const URGENT_TYPES = new Set<NotificationType>([
  NotificationType.STREAK_WARNING,
  NotificationType.ACHIEVEMENT_UNLOCKED,
]);

const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  quietHours: { enabled: false, startHour: 22, endHour: 7 },
  categories: {},
};

interface UserPrefsDoc {
  notificationPreferences?: Partial<NotificationPreferences>;
}

/** Read just the notification-preference slice of a user doc (no users-module dep). */
async function loadPreferences(userId: string): Promise<NotificationPreferences> {
  try {
    const snap = await collection<UserPrefsDoc>(Collections.USERS).doc(userId).get();
    const prefs = snap.data()?.notificationPreferences;
    if (!prefs) return DEFAULT_PREFERENCES;
    return {
      pushEnabled: prefs.pushEnabled ?? DEFAULT_PREFERENCES.pushEnabled,
      quietHours: { ...DEFAULT_PREFERENCES.quietHours, ...(prefs.quietHours ?? {}) },
      categories: prefs.categories ?? {},
    };
  } catch (err) {
    log.warn({ err, userId }, 'Failed to load notification preferences; using defaults');
    return DEFAULT_PREFERENCES;
  }
}

/** Is `hour` inside a (possibly midnight-crossing) quiet window? */
function isWithinQuietHours(quiet: QuietHours, hour: number): boolean {
  if (!quiet.enabled) return false;
  const { startHour, endHour } = quiet;
  if (startHour === endHour) return false;
  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }
  // Window crosses midnight, e.g. 22 → 7.
  return hour >= startHour || hour < endHour;
}

function categoryEnabled(prefs: NotificationPreferences, type: NotificationType): boolean {
  const explicit = prefs.categories[type];
  return explicit === undefined ? true : explicit;
}

export class NotificationService {
  /**
   * Create + deliver a notification end-to-end:
   *   1. Build copy from the template factory.
   *   2. Respect push-master toggle, per-category preference, and quiet hours.
   *   3. Persist a `pending` record, emit the realtime in-app event.
   *   4. Enqueue a `SEND_PUSH` job; the processor calls {@link deliver}.
   *
   * Returns the persisted record (which always exists, even if push is suppressed).
   */
  async notify<T extends NotificationType>(
    userId: string,
    type: T,
    data: NotificationDataMap[T],
  ): Promise<Notification> {
    const content = buildNotification(type, data);
    const prefs = await loadPreferences(userId);

    const record = await this.persist(userId, type, content);

    // Always surface in-app (the bell), even when push is muted.
    emitNotificationNew(userId, {
      id: record.id,
      type,
      title: content.title,
      body: content.body,
      createdAt: record.createdAt,
    });

    const suppressedByPrefs = !prefs.pushEnabled || !categoryEnabled(prefs, type);
    const suppressedByQuietHours =
      !URGENT_TYPES.has(type) &&
      isWithinQuietHours(prefs.quietHours, new Date().getHours());

    if (suppressedByPrefs || suppressedByQuietHours) {
      log.debug(
        { userId, type, suppressedByPrefs, suppressedByQuietHours },
        'Push suppressed; notification stored in-app only',
      );
      return record;
    }

    await enqueueSendPush({ notificationId: record.id, userId });
    return record;
  }

  /** Persist a notification history record in the `pending` state. */
  private async persist(
    userId: string,
    type: NotificationType,
    content: NotificationContent,
  ): Promise<Notification> {
    const payload: CreateInput<Notification> = {
      userId,
      type,
      title: content.title,
      body: content.body,
      data: content.data,
      status: NotificationStatus.PENDING,
      read: false,
    };
    return notificationRepository.create(payload);
  }

  /** Paginated notification history for a user, newest first. */
  async listForUser(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Notification>> {
    return notificationRepository.listForUserPaginated(userId, pagination);
  }

  /** Number of unread notifications for a user. */
  async unreadCount(userId: string): Promise<number> {
    return notificationRepository.countUnread(userId);
  }

  /** Mark a single notification as read; 404 if missing or not owned by the user. */
  async markRead(userId: string, id: string): Promise<Notification> {
    const record = await notificationRepository.markRead(id, userId);
    if (!record) throw ApiError.notFound('Notification not found');
    return record;
  }

  /** Mark every unread notification for a user as read; returns the count updated. */
  async markAllRead(userId: string): Promise<number> {
    return notificationRepository.markAllRead(userId);
  }

  /**
   * Deliver a previously-persisted notification via FCM and update its status.
   * Invoked by the SEND_PUSH job processor (so retries/backoff are handled by BullMQ).
   */
  async deliver(notificationId: string): Promise<void> {
    const record = await notificationRepository.findById(notificationId);
    if (!record) {
      log.warn({ notificationId }, 'SEND_PUSH for missing notification; skipping');
      return;
    }

    const content: NotificationContent = {
      title: record.title,
      body: record.body,
      data: record.data,
    };

    const result = await sendToUser(record.userId, content);

    if (result.successCount > 0) {
      await notificationRepository.update(notificationId, {
        status: NotificationStatus.SENT,
        sentAt: new Date().toISOString(),
      } as Partial<Notification>);
    } else {
      await notificationRepository.update(notificationId, {
        status: NotificationStatus.FAILED,
        failureReason:
          result.failureCount > 0 ? 'No device accepted the push' : 'No registered devices',
      } as Partial<Notification>);
    }
  }
}

export const notificationService = new NotificationService();
