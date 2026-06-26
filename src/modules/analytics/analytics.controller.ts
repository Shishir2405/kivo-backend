import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { analyticsService } from './analytics.service';
import type { HeatmapQuery, WeeklyReportQuery } from './analytics.validator';

export const analyticsController = {
  heatmap: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { range } = req.query as unknown as HeatmapQuery;
    const result = await analyticsService.getHeatmap(user.uid, range);
    ApiResponse.ok(res, result);
  }),

  streaks: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await analyticsService.getStreaks(user.uid);
    ApiResponse.ok(res, result);
  }),

  weekly: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const { weekStart } = req.query as unknown as WeeklyReportQuery;
    const result = await analyticsService.getWeeklyReport(user.uid, weekStart);
    ApiResponse.ok(res, result);
  }),
};
