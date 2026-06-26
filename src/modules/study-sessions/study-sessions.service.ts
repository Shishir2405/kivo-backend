import { NotificationType } from '@/constants';
import { notificationService } from '@/notifications';
import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { dayjs, startOfIsoWeek } from '@/utils/dates';
import { createLogger } from '@/utils/logger';
import type { QueryFilter } from '@/repositories/base.repository';

import { studySessionsRepository } from './study-sessions.repository';
import type { StudySession, StudySessionSummary } from './study-sessions.types';
import type {
  CreateStudySessionInput,
  ListStudySessionsQuery,
  UpdateStudySessionInput,
} from './study-sessions.validator';

const log = createLogger('study-sessions-service');

export class StudySessionsService {
  async create(userId: string, input: CreateStudySessionInput): Promise<StudySession> {
    const payload: CreateInput<StudySession> = {
      userId,
      timerType: input.timerType,
      startTime: input.startTime,
      endTime: input.endTime,
      durationMinutes: input.durationMinutes,
      interruptions: input.interruptions,
    };
    if (input.topicId !== undefined) payload.topicId = input.topicId;
    if (input.topicName !== undefined) payload.topicName = input.topicName;
    if (input.notes !== undefined) payload.notes = input.notes;
    const session = await studySessionsRepository.create(payload);

    // A recorded session is a completed focus session — nudge the user.
    // Notification delivery is best-effort: never fail the write on a push error.
    try {
      await notificationService.notify(userId, NotificationType.STUDY_TIMER_COMPLETE, {
        sessionId: session.id,
        durationMinutes: session.durationMinutes,
        ...(session.topicName !== undefined ? { topicTitle: session.topicName } : {}),
      });
    } catch (err) {
      log.warn({ err, userId, sessionId: session.id }, 'Failed to send study-timer notification');
    }

    return session;
  }

  async list(
    userId: string,
    query: ListStudySessionsQuery,
  ): Promise<PaginatedResult<StudySession>> {
    const filters: QueryFilter[] = [];
    if (query.timerType) {
      filters.push({ field: 'timerType', op: '==', value: query.timerType });
    }
    if (query.topicId) {
      filters.push({ field: 'topicId', op: '==', value: query.topicId });
    }
    if (query.from) {
      filters.push({ field: 'startTime', op: '>=', value: query.from });
    }
    if (query.to) {
      filters.push({ field: 'startTime', op: '<=', value: query.to });
    }
    return studySessionsRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { filters, orderBy: { field: 'startTime', direction: 'desc' } },
    );
  }

  async getById(userId: string, id: string): Promise<StudySession> {
    const session = await studySessionsRepository.findByIdForUser(id, userId);
    if (!session) throw ApiError.notFound('Study session not found');
    return session;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateStudySessionInput,
  ): Promise<StudySession> {
    await this.getById(userId, id);
    const updated = await studySessionsRepository.update(id, input as Partial<StudySession>);
    if (!updated) throw ApiError.notFound('Study session not found');
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await studySessionsRepository.delete(id);
  }

  /** Total focused minutes / session counts for today and the current ISO week. */
  async summary(userId: string): Promise<StudySessionSummary> {
    const weekStart = startOfIsoWeek();
    const sessions = await studySessionsRepository.findStartedSince(userId, weekStart);

    const todayStart = dayjs().startOf('day');

    let todayMinutes = 0;
    let weekMinutes = 0;
    let todaySessions = 0;
    let weekSessions = 0;

    for (const session of sessions) {
      weekMinutes += session.durationMinutes;
      weekSessions += 1;
      if (!dayjs(session.startTime).isBefore(todayStart)) {
        todayMinutes += session.durationMinutes;
        todaySessions += 1;
      }
    }

    return { todayMinutes, weekMinutes, todaySessions, weekSessions };
  }
}

export const studySessionsService = new StudySessionsService();
