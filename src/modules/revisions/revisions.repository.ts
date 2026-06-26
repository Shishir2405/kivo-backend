import { Collections, RevisionStatus } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';
import type { PaginatedResult, PaginationParams } from '@/types';

import type { Revision } from './revisions.types';

/** Data access for revision occurrences. */
export class RevisionRepository extends UserScopedRepository<Revision> {
  constructor() {
    super(Collections.REVISIONS);
  }

  /** Revisions due at-or-before `beforeIso` that are still actionable (scheduled/due/snoozed). */
  async findDueForUser(userId: string, beforeIso: string): Promise<Revision[]> {
    const revisions = await this.listForUser(userId, {
      orderBy: { field: 'dueAt', direction: 'asc' },
    });
    const actionable = new Set<string>([
      RevisionStatus.SCHEDULED,
      RevisionStatus.DUE,
      RevisionStatus.SNOOZED,
    ]);
    return revisions.filter((r) => actionable.has(r.status) && r.dueAt <= beforeIso);
  }

  /** Globally find revisions past due and not yet completed/skipped (for the sweeper). */
  async findGloballyDue(beforeIso: string, limit = 500): Promise<Revision[]> {
    return this.find({
      filters: [
        { field: 'status', op: '==', value: RevisionStatus.SCHEDULED },
        { field: 'dueAt', op: '<=', value: beforeIso },
      ],
      orderBy: { field: 'dueAt', direction: 'asc' },
      limit,
    });
  }

  paginateForUserByStatus(
    userId: string,
    pagination: PaginationParams,
    status?: RevisionStatus,
  ): Promise<PaginatedResult<Revision>> {
    const filters = status ? [{ field: 'status', op: '==' as const, value: status }] : [];
    return this.paginateForUser(userId, pagination, {
      filters,
      orderBy: { field: 'dueAt', direction: 'asc' },
    });
  }

  listForEntity(userId: string, entityId: string): Promise<Revision[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'entityId', op: '==', value: entityId }],
      orderBy: { field: 'intervalIndex', direction: 'asc' },
    });
  }

  async countCompletedForUser(userId: string): Promise<number> {
    const items = await this.listForUser(userId, {
      filters: [{ field: 'status', op: '==', value: RevisionStatus.COMPLETED }],
    });
    return items.length;
  }
}

export const revisionRepository = new RevisionRepository();
