import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { resourceService } from './resources.service';
import type {
  CreateResourceInput,
  ListResourcesQuery,
  UpdateResourceInput,
} from './resources.validator';

export const resourcesController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const resource = await resourceService.create(user.uid, req.body as CreateResourceInput);
    ApiResponse.created(res, resource);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await resourceService.list(
      user.uid,
      req.query as unknown as ListResourcesQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const resource = await resourceService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, resource);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const resource = await resourceService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateResourceInput,
    );
    ApiResponse.ok(res, resource);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await resourceService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
