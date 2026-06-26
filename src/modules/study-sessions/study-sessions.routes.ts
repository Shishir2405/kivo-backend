import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { studySessionsController } from './study-sessions.controller';
import {
  createStudySessionSchema,
  listStudySessionsQuerySchema,
  updateStudySessionSchema,
} from './study-sessions.validator';

/** Routes mounted at `/study-sessions` (behind `authenticate`). */
export const studySessionsRouter: Router = Router();

studySessionsRouter.post('/', validate(createStudySessionSchema), studySessionsController.create);
studySessionsRouter.get(
  '/',
  validate(listStudySessionsQuerySchema, 'query'),
  studySessionsController.list,
);
studySessionsRouter.get('/summary', studySessionsController.summary);
studySessionsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  studySessionsController.getById,
);
studySessionsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateStudySessionSchema }),
  studySessionsController.update,
);
studySessionsRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  studySessionsController.remove,
);
