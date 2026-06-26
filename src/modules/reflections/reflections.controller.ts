import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { reflectionsService } from './reflections.service';
import type {
  CreateReflectionInput,
  ListReflectionsQuery,
  UpdateReflectionInput,
} from './reflections.validator';

export const reflectionsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const reflection = await reflectionsService.create(
      user.uid,
      req.body as CreateReflectionInput,
    );
    ApiResponse.created(res, reflection);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await reflectionsService.list(
      user.uid,
      req.query as unknown as ListReflectionsQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const reflection = await reflectionsService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, reflection);
  }),

  getByDay: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const reflection = await reflectionsService.getByDay(
      user.uid,
      req.params.dayKey as string,
    );
    ApiResponse.ok(res, reflection);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const reflection = await reflectionsService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateReflectionInput,
    );
    ApiResponse.ok(res, reflection);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await reflectionsService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
