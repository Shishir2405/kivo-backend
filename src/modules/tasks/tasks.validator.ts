import { z } from 'zod';

import { TaskPriority, TaskStatus } from '@/constants';

const checklistItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
  completed: z.boolean().default(false),
});

export const createTaskSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(5_000).optional(),
    priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
    status: z.nativeEnum(TaskStatus).default(TaskStatus.PENDING),
    dueDate: z.string().datetime().optional(),
    reminderAt: z.string().datetime().optional(),
    checklist: z.array(checklistItemSchema).max(100).default([]),
    repeat: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
    tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  })
  .strict();
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema.partial().strict();
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const updateTaskStatusSchema = z
  .object({
    status: z.nativeEnum(TaskStatus),
  })
  .strict();
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;

export const listTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(TaskStatus).optional(),
    priority: z.nativeEnum(TaskPriority).optional(),
  })
  .strict();
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
