import {
  MasteryLevel,
  ProblemStatus,
  RevisionEntityType,
} from '@/constants';
import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { nowIso } from '@/utils/dates';

import { revisionService } from '../revisions/revisions.service';
import {
  dsaProblemRepository,
  dsaTopicRepository,
} from './dsa.repository';
import type { DsaProblem, DsaTopic } from './dsa.types';
import type {
  CreateProblemInput,
  CreateTopicInput,
  ListProblemsQuery,
  ListTopicsQuery,
  UpdateProblemInput,
  UpdateTopicInput,
} from './dsa.validator';

export class DsaService {
  // ── Topics ───────────────────────────────────────────────────────────────

  async createTopic(userId: string, input: CreateTopicInput): Promise<DsaTopic> {
    const payload: CreateInput<DsaTopic> = {
      userId,
      name: input.name,
      progress: 0,
      masteryLevel: MasteryLevel.LEARNING,
      studyTimeMinutes: 0,
      totalProblems: 0,
      completedProblems: 0,
      tags: input.tags,
      isCompleted: false,
    };
    if (input.description !== undefined) payload.description = input.description;
    return dsaTopicRepository.create(payload);
  }

  async listTopics(
    userId: string,
    query: ListTopicsQuery,
  ): Promise<PaginatedResult<DsaTopic>> {
    return dsaTopicRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { orderBy: { field: 'updatedAt', direction: 'desc' } },
    );
  }

  async getTopic(userId: string, id: string): Promise<DsaTopic> {
    const topic = await dsaTopicRepository.findByIdForUser(id, userId);
    if (!topic) throw ApiError.notFound('Topic not found');
    return topic;
  }

  async updateTopic(
    userId: string,
    id: string,
    input: UpdateTopicInput,
  ): Promise<DsaTopic> {
    await this.getTopic(userId, id);
    const updated = await dsaTopicRepository.update(id, input as Partial<DsaTopic>);
    if (!updated) throw ApiError.notFound('Topic not found');
    return updated;
  }

  /** Mark a topic complete (100% + mastered) and schedule its revision ladder. */
  async completeTopic(userId: string, id: string): Promise<DsaTopic> {
    const topic = await this.getTopic(userId, id);
    const updated = await dsaTopicRepository.update(id, {
      isCompleted: true,
      completedAt: nowIso(),
      progress: 100,
      masteryLevel: MasteryLevel.MASTERED,
    } as Partial<DsaTopic>);
    if (!updated) throw ApiError.notFound('Topic not found');

    if (!topic.isCompleted) {
      await revisionService.scheduleRevisions(
        userId,
        RevisionEntityType.TOPIC,
        id,
        undefined,
        topic.name,
      );
    }
    return updated;
  }

  async deleteTopic(userId: string, id: string): Promise<void> {
    await this.getTopic(userId, id);
    await dsaTopicRepository.delete(id);
  }

  // ── Problems ──────────────────────────────────────────────────────────────

  async createProblem(userId: string, input: CreateProblemInput): Promise<DsaProblem> {
    const isCompleted = input.status === ProblemStatus.COMPLETED;
    const payload: CreateInput<DsaProblem> = {
      userId,
      title: input.title,
      difficulty: input.difficulty,
      tags: input.tags,
      status: input.status,
      isCompleted,
    };
    if (input.topicId !== undefined) payload.topicId = input.topicId;
    if (input.platform !== undefined) payload.platform = input.platform;
    if (input.url !== undefined) payload.url = input.url;
    if (input.timeTakenMinutes !== undefined) payload.timeTakenMinutes = input.timeTakenMinutes;
    if (input.notes !== undefined) payload.notes = input.notes;
    if (input.approach !== undefined) payload.approach = input.approach;
    if (input.timeComplexity !== undefined) payload.timeComplexity = input.timeComplexity;
    if (input.spaceComplexity !== undefined) payload.spaceComplexity = input.spaceComplexity;
    if (input.journal !== undefined) payload.journal = input.journal;
    if (isCompleted) payload.dateSolved = nowIso();

    const problem = await dsaProblemRepository.create(payload);

    if (isCompleted) {
      await this.onProblemCompleted(problem);
    } else if (problem.topicId) {
      await this.syncTopicCounts(userId, problem.topicId);
    }
    return problem;
  }

  async listProblems(
    userId: string,
    query: ListProblemsQuery,
  ): Promise<PaginatedResult<DsaProblem>> {
    const filters = [];
    if (query.topicId) filters.push({ field: 'topicId', op: '==' as const, value: query.topicId });
    if (query.status) filters.push({ field: 'status', op: '==' as const, value: query.status });
    if (query.difficulty) {
      filters.push({ field: 'difficulty', op: '==' as const, value: query.difficulty });
    }
    return dsaProblemRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { filters, orderBy: { field: 'updatedAt', direction: 'desc' } },
    );
  }

  async getProblem(userId: string, id: string): Promise<DsaProblem> {
    const problem = await dsaProblemRepository.findByIdForUser(id, userId);
    if (!problem) throw ApiError.notFound('Problem not found');
    return problem;
  }

  async updateProblem(
    userId: string,
    id: string,
    input: UpdateProblemInput,
  ): Promise<DsaProblem> {
    const existing = await this.getProblem(userId, id);

    const patch: Partial<DsaProblem> = { ...input };
    const becomingCompleted =
      input.status === ProblemStatus.COMPLETED && !existing.isCompleted;
    if (input.status !== undefined) {
      patch.isCompleted = input.status === ProblemStatus.COMPLETED;
    }
    if (becomingCompleted && !existing.dateSolved) {
      patch.dateSolved = nowIso();
    }

    const updated = await dsaProblemRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Problem not found');

    if (becomingCompleted) {
      await this.onProblemCompleted(updated);
    } else if (updated.topicId) {
      await this.syncTopicCounts(userId, updated.topicId);
    }
    return updated;
  }

  async deleteProblem(userId: string, id: string): Promise<void> {
    const problem = await this.getProblem(userId, id);
    await dsaProblemRepository.delete(id);
    if (problem.topicId) {
      await this.syncTopicCounts(userId, problem.topicId);
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  /** On problem completion: schedule revisions and refresh the parent topic counts. */
  private async onProblemCompleted(problem: DsaProblem): Promise<void> {
    await revisionService.scheduleRevisions(
      problem.userId,
      RevisionEntityType.PROBLEM,
      problem.id,
      undefined,
      problem.title,
    );
    if (problem.topicId) {
      await this.syncTopicCounts(problem.userId, problem.topicId);
    }
  }

  /** Recompute denormalised problem counts + progress on a topic. */
  private async syncTopicCounts(userId: string, topicId: string): Promise<void> {
    const topic = await dsaTopicRepository.findByIdForUser(topicId, userId);
    if (!topic) return;
    const { total, completed } = await dsaProblemRepository.countByTopic(userId, topicId);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    await dsaTopicRepository.update(topicId, {
      totalProblems: total,
      completedProblems: completed,
      progress,
    } as Partial<DsaTopic>);
  }
}

export const dsaService = new DsaService();
