import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { revisionService } from './revisions.service';
import type {
  CompleteRevisionInput,
  ListRevisionsQuery,
  RescheduleRevisionInput,
  ScheduleRevisionsInput,
  SnoozeRevisionInput,
  UpdateRevisionInput,
} from './revisions.validator';

export const revisionsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await revisionService.list(
      user.uid,
      req.query as unknown as ListRevisionsQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  listDue: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const items = await revisionService.listDue(user.uid);
    ApiResponse.ok(res, items);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const revision = await revisionService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, revision);
  }),

  schedule: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = req.body as ScheduleRevisionsInput;
    const created = await revisionService.scheduleRevisions(
      user.uid,
      body.entityType,
      body.entityId,
      body.intervals,
      body.entityTitle,
    );
    ApiResponse.created(res, created);
  }),

  complete: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const revision = await revisionService.complete(
      user.uid,
      req.params.id as string,
      req.body as CompleteRevisionInput,
    );
    ApiResponse.ok(res, revision);
  }),

  snooze: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { hours } = req.body as SnoozeRevisionInput;
    const revision = await revisionService.snooze(user.uid, req.params.id as string, hours);
    ApiResponse.ok(res, revision);
  }),

  skip: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const revision = await revisionService.skip(user.uid, req.params.id as string);
    ApiResponse.ok(res, revision);
  }),

  reschedule: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const revision = await revisionService.reschedule(
      user.uid,
      req.params.id as string,
      req.body as RescheduleRevisionInput,
    );
    ApiResponse.ok(res, revision);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { notes } = req.body as UpdateRevisionInput;
    const revision = await revisionService.addNotes(
      user.uid,
      req.params.id as string,
      notes ?? '',
    );
    ApiResponse.ok(res, revision);
  }),
};
