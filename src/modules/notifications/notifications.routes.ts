import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';
import { idParamSchema } from '@/validators/common';

import { notificationsController } from './notifications.controller';
import {
  listNotificationsQuerySchema,
  testNotificationSchema,
} from './notifications.validator';

/** Routes mounted at `/notifications` (behind `authenticate`). */
export const notificationsRouter: Router = Router();

notificationsRouter.get(
  '/',
  validate(listNotificationsQuerySchema, 'query'),
  notificationsController.list,
);
notificationsRouter.get('/unread-count', notificationsController.unreadCount);
notificationsRouter.post('/read-all', notificationsController.markAllRead);
// Trigger a custom test push to the authenticated user (verifies FCM delivery).
notificationsRouter.post(
  '/test',
  validate(testNotificationSchema, 'body'),
  notificationsController.sendTest,
);
notificationsRouter.patch(
  '/:id/read',
  validate(idParamSchema, 'params'),
  notificationsController.markRead,
);
