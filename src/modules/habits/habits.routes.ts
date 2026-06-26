import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { habitsController } from './habits.controller';
import {
  completeHabitSchema,
  createHabitSchema,
  listHabitsQuerySchema,
  updateHabitSchema,
} from './habits.validator';

/** Routes mounted at `/habits` (behind `authenticate`). */
export const habitsRouter: Router = Router();

habitsRouter.post('/', validate(createHabitSchema), habitsController.create);
habitsRouter.get('/', validate(listHabitsQuerySchema, 'query'), habitsController.list);
habitsRouter.get('/:id', validate(idParamSchema, 'params'), habitsController.getById);
habitsRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateHabitSchema }),
  habitsController.update,
);
habitsRouter.post(
  '/:id/complete',
  validate({ params: idParamSchema, body: completeHabitSchema }),
  habitsController.complete,
);
habitsRouter.post(
  '/:id/uncomplete',
  validate({ params: idParamSchema, body: completeHabitSchema }),
  habitsController.uncomplete,
);
habitsRouter.delete('/:id', validate(idParamSchema, 'params'), habitsController.remove);
