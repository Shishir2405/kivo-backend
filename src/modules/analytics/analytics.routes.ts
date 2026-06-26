import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';

import { analyticsController } from './analytics.controller';
import { heatmapQuerySchema, weeklyReportQuerySchema } from './analytics.validator';

/** Routes mounted at `/analytics` (behind `authenticate`). */
export const analyticsRouter: Router = Router();

analyticsRouter.get(
  '/heatmap',
  validate(heatmapQuerySchema, 'query'),
  analyticsController.heatmap,
);
analyticsRouter.get('/streaks', analyticsController.streaks);
analyticsRouter.get(
  '/weekly',
  validate(weeklyReportQuerySchema, 'query'),
  analyticsController.weekly,
);
