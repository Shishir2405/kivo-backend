import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { noteService } from './notes.service';
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from './notes.validator';

export const notesController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const note = await noteService.create(user.uid, req.body as CreateNoteInput);
    ApiResponse.created(res, note);
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await noteService.list(user.uid, req.query as unknown as ListNotesQuery);
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const note = await noteService.getById(user.uid, req.params.id as string);
    ApiResponse.ok(res, note);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const note = await noteService.update(
      user.uid,
      req.params.id as string,
      req.body as UpdateNoteInput,
    );
    ApiResponse.ok(res, note);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await noteService.remove(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
