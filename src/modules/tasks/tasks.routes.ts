import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { tasksController } from './tasks.controller';
import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from './tasks.validator';

/** Routes mounted at `/tasks` (behind `authenticate`). */
export const tasksRouter: Router = Router();

tasksRouter.post('/', validate(createTaskSchema), tasksController.create);
tasksRouter.get('/', validate(listTasksQuerySchema, 'query'), tasksController.list);
tasksRouter.get('/:id', validate(idParamSchema, 'params'), tasksController.getById);
tasksRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateTaskSchema }),
  tasksController.update,
);
tasksRouter.patch(
  '/:id/status',
  validate({ params: idParamSchema, body: updateTaskStatusSchema }),
  tasksController.updateStatus,
);
tasksRouter.delete('/:id', validate(idParamSchema, 'params'), tasksController.remove);
