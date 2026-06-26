import {
  CONFIDENCE_INTERVAL_MULTIPLIER,
  ConfidenceRating,
  DEFAULT_REVISION_INTERVALS,
  MAX_INTERVAL_DAYS,
  MAX_REVISION_INTERVALS,
  NotificationType,
  RevisionEntityType,
  RevisionStatus,
} from '@/constants';
import { enqueueRevisionReminder } from '@/jobs/queues';
import { notificationService } from '@/notifications';
import { emitRevisionDue, emitRevisionUpdated } from '@/socket';
import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { addDays, addHours, isPast, msUntil, nowIso } from '@/utils/dates';
import { createLogger } from '@/utils/logger';

import { revisionRepository } from './revisions.repository';
import type { Revision } from './revisions.types';
import type {
  CompleteRevisionInput,
  ListRevisionsQuery,
  RescheduleRevisionInput,
} from './revisions.validator';

const log = createLogger('revision-service');

/** Clamp a computed interval to the platform's maximum. */
function clampInterval(days: number): number {
  return Math.min(Math.max(Math.round(days), 1), MAX_INTERVAL_DAYS);
}

export class RevisionService {
  /**
   * Schedule a ladder of revisions for an entity. Computes due dates from the
   * default (or custom) interval ladder, persists one revision per interval, and
   * enqueues a delayed FIRE_REVISION_REMINDER per revision.
   *
   * Re-scheduling the same entity first clears any outstanding (non-completed)
   * revisions so we never duplicate the ladder.
   */
  async scheduleRevisions(
    userId: string,
    entityType: RevisionEntityType,
    entityId: string,
    intervals?: number[],
    entityTitle?: string,
  ): Promise<Revision[]> {
    const ladder = (intervals && intervals.length > 0
      ? intervals
      : [...DEFAULT_REVISION_INTERVALS]
    )
      .slice(0, MAX_REVISION_INTERVALS)
      .map(clampInterval);

    const existing = await revisionRepository.listForEntity(userId, entityId);
    const title =
      entityTitle ?? existing.find((r) => r.entityTitle)?.entityTitle ?? entityId;

    // Clear outstanding (not completed) revisions to avoid a duplicate ladder.
    await Promise.all(
      existing
        .filter((r) => r.status !== RevisionStatus.COMPLETED)
        .map((r) => revisionRepository.delete(r.id)),
    );

    const created: Revision[] = [];
    for (let i = 0; i < ladder.length; i += 1) {
      const intervalDays = ladder[i] as number;
      const dueAt = addDays(intervalDays);
      const payload: CreateInput<Revision> = {
        userId,
        entityType,
        entityId,
        entityTitle: title,
        intervalIndex: i + 1,
        intervalDays,
        dueAt,
        status: RevisionStatus.SCHEDULED,
        snoozeCount: 0,
      };
      const revision = await revisionRepository.create(payload);
      created.push(revision);
      await enqueueRevisionReminder(revision.id, msUntil(dueAt));
    }

    log.info({ userId, entityId, count: created.length }, 'Scheduled revisions');
    return created;
  }

  async getById(userId: string, id: string): Promise<Revision> {
    const revision = await revisionRepository.findByIdForUser(id, userId);
    if (!revision) throw ApiError.notFound('Revision not found');
    return revision;
  }

  async list(userId: string, query: ListRevisionsQuery): Promise<PaginatedResult<Revision>> {
    if (query.today) {
      const dueToday = await this.listDueToday(userId);
      const start = (query.page - 1) * query.limit;
      const items = dueToday.slice(start, start + query.limit);
      const total = dueToday.length;
      return {
        items,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: start + query.limit < total,
          hasPrev: query.page > 1,
        },
      };
    }
    return revisionRepository.paginateForUserByStatus(
      userId,
      { page: query.page, limit: query.limit },
      query.status,
    );
  }

  /** Revisions due now-or-earlier (the "due" inbox). */
  async listDue(userId: string): Promise<Revision[]> {
    return revisionRepository.findDueForUser(userId, nowIso());
  }

  /** Revisions due by end of today (local). */
  async listDueToday(userId: string): Promise<Revision[]> {
    const endOfDay = addHours(24, new Date(new Date().setHours(0, 0, 0, 0)));
    return revisionRepository.findDueForUser(userId, endOfDay);
  }

  /**
   * Complete a revision with a confidence rating. The rating adjusts the *next*
   * interval (shrink when hard, stretch when easy) and schedules the next rung of
   * the ladder if there is one.
   */
  async complete(
    userId: string,
    id: string,
    input: CompleteRevisionInput,
  ): Promise<Revision> {
    const revision = await this.getById(userId, id);
    if (revision.status === RevisionStatus.COMPLETED) {
      throw ApiError.conflict('Revision already completed');
    }

    const patch: Partial<Revision> = {
      status: RevisionStatus.COMPLETED,
      confidence: input.confidence,
      completedAt: nowIso(),
    };
    if (input.notes !== undefined) patch.notes = input.notes;

    const updated = await revisionRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Revision not found');

    await this.scheduleNextRung(updated, input.confidence);
    emitRevisionUpdated(userId, { revisionId: id, status: RevisionStatus.COMPLETED });
    return updated;
  }

  /** Snooze a revision: push its due time and re-enqueue the reminder. */
  async snooze(userId: string, id: string, hours: number): Promise<Revision> {
    const revision = await this.getById(userId, id);
    const dueAt = addHours(hours);
    const updated = await revisionRepository.update(id, {
      status: RevisionStatus.SNOOZED,
      dueAt,
      snoozeCount: revision.snoozeCount + 1,
    } as Partial<Revision>);
    if (!updated) throw ApiError.notFound('Revision not found');

    await enqueueRevisionReminder(id, msUntil(dueAt));
    emitRevisionUpdated(userId, { revisionId: id, status: RevisionStatus.SNOOZED });
    return updated;
  }

  async skip(userId: string, id: string): Promise<Revision> {
    await this.getById(userId, id);
    const updated = await revisionRepository.update(id, {
      status: RevisionStatus.SKIPPED,
    } as Partial<Revision>);
    if (!updated) throw ApiError.notFound('Revision not found');
    emitRevisionUpdated(userId, { revisionId: id, status: RevisionStatus.SKIPPED });
    return updated;
  }

  /** Reschedule to an explicit due date and re-enqueue the reminder. */
  async reschedule(
    userId: string,
    id: string,
    input: RescheduleRevisionInput,
  ): Promise<Revision> {
    await this.getById(userId, id);
    const updated = await revisionRepository.update(id, {
      status: RevisionStatus.SCHEDULED,
      dueAt: input.dueAt,
    } as Partial<Revision>);
    if (!updated) throw ApiError.notFound('Revision not found');

    await enqueueRevisionReminder(id, msUntil(input.dueAt));
    emitRevisionUpdated(userId, { revisionId: id, status: RevisionStatus.SCHEDULED });
    return updated;
  }

  async addNotes(userId: string, id: string, notes: string): Promise<Revision> {
    await this.getById(userId, id);
    const updated = await revisionRepository.update(id, { notes } as Partial<Revision>);
    if (!updated) throw ApiError.notFound('Revision not found');
    return updated;
  }

  /**
   * FIRE_REVISION_REMINDER processor. Re-checks the revision is still actionable
   * (not completed/skipped, and actually due), then notifies + emits the realtime
   * event. Idempotent and safe to re-run.
   */
  async fireReminder(revisionId: string): Promise<void> {
    const revision = await revisionRepository.findById(revisionId);
    if (!revision) {
      log.debug({ revisionId }, 'Reminder for missing revision; skipping');
      return;
    }
    const stillActionable =
      revision.status === RevisionStatus.SCHEDULED ||
      revision.status === RevisionStatus.SNOOZED ||
      revision.status === RevisionStatus.DUE;
    if (!stillActionable || !isPast(revision.dueAt)) {
      log.debug(
        { revisionId, status: revision.status },
        'Revision no longer due; skipping reminder',
      );
      return;
    }

    if (revision.status !== RevisionStatus.DUE) {
      await revisionRepository.update(revisionId, {
        status: RevisionStatus.DUE,
      } as Partial<Revision>);
    }

    await notificationService.notify(revision.userId, NotificationType.REVISION_REMINDER, {
      revisionId: revision.id,
      entityTitle: revision.entityTitle,
      entityType: revision.entityType,
      dueAt: revision.dueAt,
    });

    emitRevisionDue(revision.userId, {
      revisionId: revision.id,
      entityType: revision.entityType,
      entityTitle: revision.entityTitle,
      dueAt: revision.dueAt,
    });
  }

  /**
   * SWEEP_DUE_REVISIONS processor. Transitions overdue `scheduled` revisions to
   * `due` and fires their reminders. Returns the number transitioned.
   */
  async sweepDueRevisions(): Promise<number> {
    const due = await revisionRepository.findGloballyDue(nowIso());
    for (const revision of due) {
      await this.fireReminder(revision.id);
    }
    return due.length;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /**
   * Schedule the next interval after a completion, applying the confidence
   * multiplier to the *base* next interval from the default ladder.
   */
  private async scheduleNextRung(
    completed: Revision,
    confidence: ConfidenceRating,
  ): Promise<void> {
    const nextIndex = completed.intervalIndex; // 0-based into ladder == next rung
    if (nextIndex >= DEFAULT_REVISION_INTERVALS.length) {
      // Mastered the full ladder — nothing more to schedule.
      return;
    }
    const baseInterval = DEFAULT_REVISION_INTERVALS[nextIndex] as number;
    const multiplier = CONFIDENCE_INTERVAL_MULTIPLIER[confidence];
    const intervalDays = clampInterval(baseInterval * multiplier);
    const dueAt = addDays(intervalDays);

    const payload: CreateInput<Revision> = {
      userId: completed.userId,
      entityType: completed.entityType,
      entityId: completed.entityId,
      entityTitle: completed.entityTitle,
      intervalIndex: completed.intervalIndex + 1,
      intervalDays,
      dueAt,
      status: RevisionStatus.SCHEDULED,
      snoozeCount: 0,
    };
    const next = await revisionRepository.create(payload);
    await enqueueRevisionReminder(next.id, msUntil(dueAt));
  }
}

export const revisionService = new RevisionService();
