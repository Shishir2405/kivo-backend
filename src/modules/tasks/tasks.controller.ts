import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { taskService } from './tasks.service';
import type {
  CreateTaskInput,
  ListTasksQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from './tasks.validator';

export const tasksController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const task = await taskService.create(user.uid, req.body as CreateTaskInput);
    ApiResponse.created(res, task);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await taskService.list(user.uid, req.query as unknown as ListTasksQuery);
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const task = await taskService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, task);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const task = await taskService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateTaskInput,
    );
    ApiResponse.ok(res, task);
  }),

  updateStatus: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const task = await taskService.updateStatus(
      user.uid,
      req.params.id as string,
      req.body as UpdateTaskStatusInput,
    );
    ApiResponse.ok(res, task);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await taskService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
