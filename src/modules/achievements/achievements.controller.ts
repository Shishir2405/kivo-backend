import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { achievementsService } from './achievements.service';

export const achievementsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const summary = await achievementsService.listForUser(user.uid);
    ApiResponse.ok(res, summary.achievements, { totalXp: summary.totalXp });
  }),

  catalog: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const entries = await achievementsService.catalogForUser(user.uid);
    ApiResponse.ok(res, entries);
  }),
};
