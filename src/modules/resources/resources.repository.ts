import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Resource } from './resources.types';

export class ResourceRepository extends UserScopedRepository<Resource> {
  constructor() {
    super(Collections.RESOURCES);
  }

  listByTopic(userId: string, topicId: string): Promise<Resource[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'topicId', op: '==', value: topicId }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }
}

export const resourceRepository = new ResourceRepository();
