import { Router } from 'express';

import { achievementsController } from './achievements.controller';

/** Routes mounted at `/achievements` (behind `authenticate`). */
export const achievementsRouter: Router = Router();

achievementsRouter.get('/', achievementsController.list);
achievementsRouter.get('/catalog', achievementsController.catalog);
