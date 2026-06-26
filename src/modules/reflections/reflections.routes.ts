import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { reflectionsController } from './reflections.controller';
import {
  createReflectionSchema,
  dayKeyParamSchema,
  listReflectionsQuerySchema,
  updateReflectionSchema,
} from './reflections.validator';

/** Routes mounted at `/reflections` (behind `authenticate`). */
export const reflectionsRouter: Router = Router();

reflectionsRouter.post('/', validate(createReflectionSchema), reflectionsController.create);
reflectionsRouter.get(
  '/',
  validate(listReflectionsQuerySchema, 'query'),
  reflectionsController.list,
);
reflectionsRouter.get(
  '/by-date/:dayKey',
  validate(dayKeyParamSchema, 'params'),
  reflectionsController.getByDay,
);
reflectionsRouter.get('/:id', validate(idParamSchema, 'params'), reflectionsController.getById);
reflectionsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateReflectionSchema }),
  reflectionsController.update,
);
reflectionsRouter.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  reflectionsController.remove,
);
