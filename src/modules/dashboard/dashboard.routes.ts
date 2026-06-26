import { Router } from 'express';

import { dashboardController } from './dashboard.controller';

/** Routes mounted at `/dashboard` (behind `authenticate`). */
export const dashboardRouter: Router = Router();

dashboardRouter.get('/', dashboardController.get);
