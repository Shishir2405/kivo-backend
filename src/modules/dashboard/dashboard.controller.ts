import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { dashboardService } from './dashboard.service';

export const dashboardController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const dashboard = await dashboardService.getDashboard(user.uid);
    ApiResponse.ok(res, dashboard);
  }),
};
