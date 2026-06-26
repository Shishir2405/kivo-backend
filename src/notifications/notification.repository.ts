import { Collections, NotificationStatus } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';
import type { PaginatedResult, PaginationParams } from '@/types';

import type { Notification } from './notification.types';

/** Data access for notification history records. */
export class NotificationRepository extends UserScopedRepository<Notification> {
  constructor() {
    super(Collections.NOTIFICATIONS);
  }

  /** Paginated history for a user, newest first. */
  async listForUserPaginated(
    userId: string,
    pagination: PaginationParams,
    filters: { status?: NotificationStatus; read?: boolean } = {},
  ): Promise<PaginatedResult<Notification>> {
    const queryFilters = [];
    if (filters.status) {
      queryFilters.push({ field: 'status', op: '==' as const, value: filters.status });
    }
    if (typeof filters.read === 'boolean') {
      queryFilters.push({ field: 'read', op: '==' as const, value: filters.read });
    }
    return this.paginateForUser(userId, pagination, {
      filters: queryFilters,
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  /**
   * Mark a single notification as read for the owning user. Returns the updated
   * record, or `null` if it does not exist or belongs to another user.
   */
  async markRead(id: string, userId: string): Promise<Notification | null> {
    const existing = await this.findByIdForUser(id, userId);
    if (!existing) return null;
    if (existing.read) return existing;
    return this.update(id, {
      read: true,
      readAt: new Date().toISOString(),
      status: NotificationStatus.READ,
    } as Partial<Notification>);
  }

  async countUnread(userId: string): Promise<number> {
    const items = await this.listForUser(userId, {
      filters: [{ field: 'read', op: '==', value: false }],
    });
    return items.length;
  }

  /** Mark every unread notification for a user as read; returns the count updated. */
  async markAllRead(userId: string): Promise<number> {
    const unread = await this.listForUser(userId, {
      filters: [{ field: 'read', op: '==', value: false }],
    });
    if (unread.length === 0) return 0;

    const now = new Date().toISOString();
    await Promise.all(
      unread.map((n) =>
        this.update(n.id, {
          read: true,
          readAt: now,
          status: NotificationStatus.READ,
        } as Partial<Notification>),
      ),
    );
    return unread.length;
  }
}

export const notificationRepository = new NotificationRepository();
