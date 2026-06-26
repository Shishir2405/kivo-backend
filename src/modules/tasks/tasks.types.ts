import type { TaskPriority, TaskStatus } from '@/constants';
import type { BaseEntity } from '@/types';

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export type RepeatFrequency = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Task extends BaseEntity {
  userId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  /** When to remind (ISO). */
  reminderAt?: string;
  /** Sub-tasks / checklist. */
  checklist: ChecklistItem[];
  repeat: RepeatFrequency;
  tags: string[];
  completedAt?: string;
}
