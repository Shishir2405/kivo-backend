import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { notesController } from './notes.controller';
import {
  createNoteSchema,
  listNotesQuerySchema,
  updateNoteSchema,
} from './notes.validator';

/** Routes mounted at `/notes` (behind `authenticate`). */
export const notesRouter: Router = Router();

notesRouter.post('/', validate(createNoteSchema), notesController.create);
notesRouter.get('/', validate(listNotesQuerySchema, 'query'), notesController.list);
notesRouter.get('/:id', validate(idParamSchema, 'params'), notesController.getById);
notesRouter.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateNoteSchema }),
  notesController.update,
);
notesRouter.delete('/:id', validate(idParamSchema, 'params'), notesController.remove);
