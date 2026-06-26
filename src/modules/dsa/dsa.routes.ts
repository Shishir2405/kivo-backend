import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { dsaController } from './dsa.controller';
import {
  createProblemSchema,
  createTopicSchema,
  listProblemsQuerySchema,
  listTopicsQuerySchema,
  updateProblemSchema,
  updateTopicSchema,
} from './dsa.validator';

/** Routes mounted at `/dsa` (behind `authenticate`). */
export const dsaRouter: Router = Router();

// Topics
dsaRouter.post('/topics', validate(createTopicSchema), dsaController.createTopic);
dsaRouter.get('/topics', validate(listTopicsQuerySchema, 'query'), dsaController.listTopics);
dsaRouter.get('/topics/:id', validate(idParamSchema, 'params'), dsaController.getTopic);
dsaRouter.patch(
  '/topics/:id',
  validate({ params: idParamSchema, body: updateTopicSchema }),
  dsaController.updateTopic,
);
dsaRouter.post(
  '/topics/:id/complete',
  validate(idParamSchema, 'params'),
  dsaController.completeTopic,
);
dsaRouter.delete('/topics/:id', validate(idParamSchema, 'params'), dsaController.deleteTopic);

// Problems
dsaRouter.post('/problems', validate(createProblemSchema), dsaController.createProblem);
dsaRouter.get(
  '/problems',
  validate(listProblemsQuerySchema, 'query'),
  dsaController.listProblems,
);
dsaRouter.get('/problems/:id', validate(idParamSchema, 'params'), dsaController.getProblem);
dsaRouter.patch(
  '/problems/:id',
  validate({ params: idParamSchema, body: updateProblemSchema }),
  dsaController.updateProblem,
);
dsaRouter.delete(
  '/problems/:id',
  validate(idParamSchema, 'params'),
  dsaController.deleteProblem,
);
