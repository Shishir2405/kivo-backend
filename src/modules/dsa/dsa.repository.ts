import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { DsaProblem, DsaTopic } from './dsa.types';

export class DsaTopicRepository extends UserScopedRepository<DsaTopic> {
  constructor() {
    super(Collections.DSA_TOPICS);
  }
}

export class DsaProblemRepository extends UserScopedRepository<DsaProblem> {
  constructor() {
    super(Collections.PROBLEMS);
  }

  listByTopic(userId: string, topicId: string): Promise<DsaProblem[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'topicId', op: '==', value: topicId }],
    });
  }

  async countByTopic(
    userId: string,
    topicId: string,
  ): Promise<{ total: number; completed: number }> {
    const problems = await this.listByTopic(userId, topicId);
    return {
      total: problems.length,
      completed: problems.filter((p) => p.isCompleted).length,
    };
  }
}

export const dsaTopicRepository = new DsaTopicRepository();
export const dsaProblemRepository = new DsaProblemRepository();
