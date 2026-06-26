import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { buildPaginatedResult } from '@/utils/pagination';

import { reflectionsRepository } from './reflections.repository';
import type { Reflection } from './reflections.types';
import type {
  CreateReflectionInput,
  ListReflectionsQuery,
  UpdateReflectionInput,
} from './reflections.validator';

/** Lightweight client-side text match (Firestore lacks full-text search). */
function matchesSearch(reflection: Reflection, term: string): boolean {
  const needle = term.toLowerCase();
  return (
    reflection.dayKey.toLowerCase().includes(needle) ||
    reflection.learned.toLowerCase().includes(needle) ||
    reflection.challenged.toLowerCase().includes(needle) ||
    reflection.tomorrowPlan.toLowerCase().includes(needle)
  );
}

export class ReflectionsService {
  /**
   * Create or upsert the user's reflection for a day. Reflections are unique per
   * user per `dayKey`, so a second create for the same day updates the existing
   * entry rather than producing a duplicate.
   */
  async create(userId: string, input: CreateReflectionInput): Promise<Reflection> {
    const existing = await reflectionsRepository.findByDay(userId, input.dayKey);
    if (existing) {
      const patch: Partial<Reflection> = {
        learned: input.learned,
        challenged: input.challenged,
        goalsCompleted: input.goalsCompleted,
        focusLevel: input.focusLevel,
        confidence: input.confidence,
        tomorrowPlan: input.tomorrowPlan,
      };
      if (input.mood !== undefined) patch.mood = input.mood;
      const updated = await reflectionsRepository.update(existing.id, patch);
      if (!updated) throw ApiError.notFound('Reflection not found');
      return updated;
    }

    const payload: CreateInput<Reflection> = {
      userId,
      dayKey: input.dayKey,
      learned: input.learned,
      challenged: input.challenged,
      goalsCompleted: input.goalsCompleted,
      focusLevel: input.focusLevel,
      confidence: input.confidence,
      tomorrowPlan: input.tomorrowPlan,
    };
    if (input.mood !== undefined) payload.mood = input.mood;
    return reflectionsRepository.create(payload);
  }

  /**
   * List reflections with optional date-range filtering + free-text search. When
   * `search` is set we fetch the user's reflections and filter in memory
   * (acceptable at per-user scale).
   */
  async list(
    userId: string,
    query: ListReflectionsQuery,
  ): Promise<PaginatedResult<Reflection>> {
    const filters = [];
    if (query.from) filters.push({ field: 'dayKey', op: '>=' as const, value: query.from });
    if (query.to) filters.push({ field: 'dayKey', op: '<=' as const, value: query.to });
    if (typeof query.goalsCompleted === 'boolean') {
      filters.push({ field: 'goalsCompleted', op: '==' as const, value: query.goalsCompleted });
    }

    const pagination = { page: query.page, limit: query.limit };

    if (!query.search) {
      return reflectionsRepository.paginateForUser(userId, pagination, {
        filters,
        orderBy: { field: 'dayKey', direction: 'desc' },
      });
    }

    const all = await reflectionsRepository.listForUser(userId, { filters });
    const matched = all
      .filter((r) => matchesSearch(r, query.search as string))
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey));
    const start = (pagination.page - 1) * pagination.limit;
    return buildPaginatedResult(
      matched.slice(start, start + pagination.limit),
      matched.length,
      pagination,
    );
  }

  async getById(userId: string, id: string): Promise<Reflection> {
    const reflection = await reflectionsRepository.findByIdForUser(id, userId);
    if (!reflection) throw ApiError.notFound('Reflection not found');
    return reflection;
  }

  async getByDay(userId: string, dayKey: string): Promise<Reflection> {
    const reflection = await reflectionsRepository.findByDay(userId, dayKey);
    if (!reflection) throw ApiError.notFound('Reflection not found');
    return reflection;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateReflectionInput,
  ): Promise<Reflection> {
    await this.getById(userId, id);
    const updated = await reflectionsRepository.update(id, input as Partial<Reflection>);
    if (!updated) throw ApiError.notFound('Reflection not found');
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await reflectionsRepository.delete(id);
  }
}

export const reflectionsService = new ReflectionsService();
