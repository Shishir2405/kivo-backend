import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { notificationsController } from './notifications.controller';
import { listNotificationsQuerySchema } from './notifications.validator';

/** Routes mounted at `/notifications` (behind `authenticate`). */
export const notificationsRouter: Router = Router();

notificationsRouter.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationsController.list,
);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.post('/read-all', notificationsController.markAllRead);
notificationsRouter.patch(
  '/:id/read',
  validate(idParamSchema, 'params'),
  notificationsController.markRead,
);
