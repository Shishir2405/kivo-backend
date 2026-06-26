import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';

import { resourceRepository } from './resources.repository';
import type { Resource } from './resources.types';
import type {
  CreateResourceInput,
  ListResourcesQuery,
  UpdateResourceInput,
} from './resources.validator';

export class ResourceService {
  async create(userId: string, input: CreateResourceInput): Promise<Resource> {
    const payload: CreateInput<Resource> = {
      userId,
      title: input.title,
      url: input.url,
      type: input.type,
      tags: input.tags,
      isCompleted: input.isCompleted,
    };
    if (input.topicId !== undefined) payload.topicId = input.topicId;
    if (input.description !== undefined) payload.description = input.description;
    return resourceRepository.create(payload);
  }

  async list(
    userId: string,
    query: ListResourcesQuery,
  ): Promise<PaginatedResult<Resource>> {
    const filters = [];
    if (query.topicId) {
      filters.push({ field: 'topicId', op: '==' as const, value: query.topicId });
    }
    if (query.type) filters.push({ field: 'type', op: '==' as const, value: query.type });
    return resourceRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { filters, orderBy: { field: 'createdAt', direction: 'desc' } },
    );
  }

  async getById(userId: string, id: string): Promise<Resource> {
    const resource = await resourceRepository.findByIdForUser(id, userId);
    if (!resource) throw ApiError.notFound('Resource not found');
    return resource;
  }

  async update(
    userId: string,
    id: string,
    input: UpdateResourceInput,
  ): Promise<Resource> {
    await this.getById(userId, id);
    const updated = await resourceRepository.update(id, input as Partial<Resource>);
    if (!updated) throw ApiError.notFound('Resource not found');
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await resourceRepository.delete(id);
  }
}

export const resourceService = new ResourceService();
