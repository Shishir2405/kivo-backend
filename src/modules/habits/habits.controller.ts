import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { habitsService } from './habits.service';
import type {
  CompleteHabitInput,
  CreateHabitInput,
  ListHabitsQuery,
  UpdateHabitInput,
} from './habits.validator';

export const habitsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const habit = await habitsService.create(user.uid, req.body as CreateHabitInput);
    ApiResponse.created(res, habit);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await habitsService.list(user.uid, req.query as unknown as ListHabitsQuery);
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const habit = await habitsService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, habit);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const habit = await habitsService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateHabitInput,
    );
    ApiResponse.ok(res, habit);
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const habit = await habitsService.complete(
      user.uid,
      req.params.id as string,
      req.body as CompleteHabitInput,
    );
    ApiResponse.ok(res, habit);
  }),

  uncomplete: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const habit = await habitsService.uncomplete(
      user.uid,
      req.params.id as string,
      req.body as CompleteHabitInput,
    );
    ApiResponse.ok(res, habit);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await habitsService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
