import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { studySessionsService } from './study-sessions.service';
import type {
  CreateStudySessionInput,
  ListStudySessionsQuery,
  UpdateStudySessionInput,
} from './study-sessions.validator';

export const studySessionsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const session = await studySessionsService.create(
      user.uid,
      req.body as CreateStudySessionInput,
    );
    ApiResponse.created(res, session);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await studySessionsService.list(
      user.uid,
      req.query as unknown as ListStudySessionsQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  summary: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const summary = await studySessionsService.summary(user.uid);
    ApiResponse.ok(res, summary);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const session = await studySessionsService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, session);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const session = await studySessionsService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateStudySessionInput,
    );
    ApiResponse.ok(res, session);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await studySessionsService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
