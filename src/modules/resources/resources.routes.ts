import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { resourcesController } from './resources.controller';
import {
  createResourceSchema,
  listResourcesQuerySchema,
  updateResourceSchema,
} from './resources.validator';

/** Routes mounted at `/resources` (behind `authenticate`). */
export const resourcesRouter: Router = Router();

resourcesRouter.post('/', validate(createResourceSchema), resourcesController.create);
resourcesRouter.get('/', validate(listResourcesQuerySchema, 'query'), resourcesController.list);
resourcesRouter.get('/:id', validate(idParamSchema, 'params'), resourcesController.getById);
resourcesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateResourceSchema }),
  resourcesController.update,
);
resourcesRouter.delete('/:id', validate(idParamSchema, 'params'), resourcesController.remove);
