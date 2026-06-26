import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { StudySession } from './study-sessions.types';

export class StudySessionsRepository extends UserScopedRepository<StudySession> {
  constructor() {
    super(Collections.STUDY_SESSIONS);
  }

  /** Sessions that started on-or-after `sinceIso`, newest first. */
  findStartedSince(userId: string, sinceIso: string): Promise<StudySession[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'startTime', op: '>=', value: sinceIso }],
      orderBy: { field: 'startTime', direction: 'desc' },
    });
  }
}

export const studySessionsRepository = new StudySessionsRepository();
