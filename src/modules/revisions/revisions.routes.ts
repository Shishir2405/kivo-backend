import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { revisionsController } from './revisions.controller';
import {
  completeRevisionSchema,
  listRevisionsQuerySchema,
  rescheduleRevisionSchema,
  scheduleRevisionsSchema,
  snoozeRevisionSchema,
  updateRevisionSchema,
} from './revisions.validator';

/** Routes mounted at `/revisions` (behind `authenticate`). */
export const revisionsRouter: Router = Router();

revisionsRouter.get('/', validate(listRevisionsQuerySchema, 'query'), revisionsController.list);
revisionsRouter.get('/due', revisionsController.listDue);

revisionsRouter.post(
  '/schedule',
  validate(scheduleRevisionsSchema),
  revisionsController.schedule,
);

revisionsRouter.get(
  '/:id',
  validate(idParamSchema, 'params'),
  revisionsController.getById,
);
revisionsRouter.post(
  '/:id/complete',
  validate({ params: idParamSchema, body: completeRevisionSchema }),
  revisionsController.complete,
);
revisionsRouter.post(
  '/:id/snooze',
  validate({ params: idParamSchema, body: snoozeRevisionSchema }),
  revisionsController.snooze,
);
revisionsRouter.post(
  '/:id/skip',
  validate(idParamSchema, 'params'),
  revisionsController.skip,
);
revisionsRouter.post(
  '/:id/reschedule',
  validate({ params: idParamSchema, body: rescheduleRevisionSchema }),
  revisionsController.reschedule,
);
revisionsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateRevisionSchema }),
  revisionsController.update,
);
