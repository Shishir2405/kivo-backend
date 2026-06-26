import { Router } from 'express';

import { validate } from '@/middleware/validate.middleware';

import { usersController } from './users.controller';
import {
  registerDeviceSchema,
  unregisterDeviceSchema,
  updateNotificationPreferencesSchema,
  updatePreferencesSchema,
  updateProfileSchema,
} from './users.validator';

/**
 * Routes mounted at `/users`. The router is mounted behind `authenticate`, so every
 * handler can rely on `req.user`.
 */
export const usersRouter: Router = Router();

usersRouter.get('/me', usersController.getMe);
usersRouter.patch('/me', validate(updateProfileSchema), usersController.updateMe);
usersRouter.patch(
  '/me/preferences',
  validate(updatePreferencesSchema),
  usersController.updatePreferences,
);
usersRouter.patch(
  '/me/notification-preferences',
  validate(updateNotificationPreferencesSchema),
  usersController.updateNotificationPreferences,
);

usersRouter.get('/me/devices', usersController.listDevices);
usersRouter.post(
  '/me/devices',
  validate(registerDeviceSchema),
  usersController.registerDevice,
);
usersRouter.delete(
  '/me/devices',
  validate(unregisterDeviceSchema),
  usersController.unregisterDevice,
);
