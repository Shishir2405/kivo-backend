import { TaskStatus } from '@/constants';
import { emitTaskUpdated } from '@/socket';
import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { isPast, nowIso } from '@/utils/dates';

import { taskRepository } from './tasks.repository';
import type { Task } from './tasks.types';
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './tasks.validator';

/** Compute the effective status, flagging overdue open tasks. */
function withComputedStatus(task: Task): Task {
  if (
    task.dueDate &&
    (task.status === TaskStatus.PENDING || task.status === TaskStatus.IN_PROGRESS) &&
    isPast(task.dueDate)
  ) {
    return { ...task, status: TaskStatus.OVERDUE };
  }
  return task;
}

export class TaskService {
  async create(userId: string, input: CreateTaskInput): Promise<Task> {
    const payload: CreateInput<Task> = {
      userId,
      title: input.title,
      status: input.status,
      priority: input.priority,
      checklist: input.checklist,
      repeat: input.repeat,
      tags: input.tags,
    };
    if (input.description !== undefined) payload.description = input.description;
    if (input.dueDate !== undefined) payload.dueDate = input.dueDate;
    if (input.reminderAt !== undefined) payload.reminderAt = input.reminderAt;
    if (input.status === TaskStatus.COMPLETED) payload.completedAt = nowIso();
    return taskRepository.create(payload);
  }

  async list(userId: string, query: ListTasksQuery): Promise<PaginatedResult<Task>> {
    const filters = [];
    if (query.status) filters.push({ field: 'status', op: '==' as const, value: query.status });
    if (query.priority) {
      filters.push({ field: 'priority', op: '==' as const, value: query.priority });
    }
    const result = await taskRepository.paginateForUser(
      userId,
      { page: query.page, limit: query.limit },
      { filters, orderBy: { field: 'createdAt', direction: 'desc' } },
    );
    return { ...result, items: result.items.map(withComputedStatus) };
  }

  async getById(userId: string, id: string): Promise<Task> {
    const task = await taskRepository.findByIdForUser(id, userId);
    if (!task) throw ApiError.notFound('Task not found');
    return withComputedStatus(task);
  }

  async update(userId: string, id: string, input: UpdateTaskInput): Promise<Task> {
    const existing = await this.getById(userId, id);
    const patch: Partial<Task> = { ...input };
    if (input.status === TaskStatus.COMPLETED && existing.status !== TaskStatus.COMPLETED) {
      patch.completedAt = nowIso();
    }
    const updated = await taskRepository.update(id, patch);
    if (!updated) throw ApiError.notFound('Task not found');
    emitTaskUpdated(userId, { taskId: id, status: updated.status });
    return withComputedStatus(updated);
  }

  async updateStatus(
    userId: string,
    id: string,
    input: UpdateTaskStatusInput,
  ): Promise<Task> {
    return this.update(userId, id, { status: input.status });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await taskRepository.delete(id);
  }
}

export const taskService = new TaskService();
