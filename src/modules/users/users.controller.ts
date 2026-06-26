import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { userService } from './users.service';
import type {
  RegisterDeviceInput,
  UnregisterDeviceInput,
  UpdateNotificationPreferencesInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from './users.validator';

export const usersController = {
  getMe: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const profile = await userService.getProfile(user.uid);
    ApiResponse.ok(res, profile);
  }),

  updateMe: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const profile = await userService.updateProfile(user.uid, req.body as UpdateProfileInput);
    ApiResponse.ok(res, profile);
  }),

  updatePreferences: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const profile = await userService.updatePreferences(
      user.uid,
      req.body as UpdatePreferencesInput,
    );
    ApiResponse.ok(res, profile);
  }),

  updateNotificationPreferences: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const profile = await userService.updateNotificationPreferences(
      user.uid,
      req.body as UpdateNotificationPreferencesInput,
    );
    ApiResponse.ok(res, profile);
  }),

  listDevices: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const devices = await userService.listDevices(user.uid);
    ApiResponse.ok(res, devices);
  }),

  registerDevice: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const device = await userService.registerDevice(user.uid, req.body as RegisterDeviceInput);
    ApiResponse.created(res, device);
  }),

  unregisterDevice: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await userService.unregisterDevice(user.uid, req.body as UnregisterDeviceInput);
    ApiResponse.noContent(res);
  }),
};
