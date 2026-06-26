import { Collections, TaskStatus } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Task } from './tasks.types';

export class TaskRepository extends UserScopedRepository<Task> {
  constructor() {
    super(Collections.TASKS);
  }

  /** Tasks due on-or-before `beforeIso` that aren't done/cancelled. */
  async findDueBefore(userId: string, beforeIso: string): Promise<Task[]> {
    const tasks = await this.listForUser(userId, {
      orderBy: { field: 'dueDate', direction: 'asc' },
    });
    const open = new Set<string>([
      TaskStatus.PENDING,
      TaskStatus.IN_PROGRESS,
      TaskStatus.OVERDUE,
    ]);
    return tasks.filter(
      (t) => open.has(t.status) && t.dueDate !== undefined && t.dueDate <= beforeIso,
    );
  }

  async findCompletedSince(userId: string, sinceIso: string): Promise<Task[]> {
    return this.listForUser(userId, {
      filters: [
        { field: 'status', op: '==', value: TaskStatus.COMPLETED },
        { field: 'completedAt', op: '>=', value: sinceIso },
      ],
    });
  }
}

export const taskRepository = new TaskRepository();
