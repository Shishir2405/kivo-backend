import { deviceTokenRepository } from '@/notifications/deviceToken.repository';
import type { DeviceToken } from '@/notifications/notification.types';
import { ApiError } from '@/utils/ApiError';

import { userRepository } from './users.repository';
import type { User } from './users.types';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
} from './users.types';
import type {
  RegisterDeviceInput,
  UnregisterDeviceInput,
  UpdateNotificationPreferencesInput,
  UpdatePreferencesInput,
  UpdateProfileInput,
} from './users.validator';

export class UserService {
  async getProfile(uid: string): Promise<User> {
    const user = await userRepository.findByUid(uid);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  async updateProfile(uid: string, input: UpdateProfileInput): Promise<User> {
    await this.getProfile(uid);
    const updated = await userRepository.update(uid, input as Partial<User>);
    if (!updated) throw ApiError.notFound('User not found');
    return updated;
  }

  async updatePreferences(uid: string, input: UpdatePreferencesInput): Promise<User> {
    const user = await this.getProfile(uid);
    const preferences = { ...DEFAULT_USER_PREFERENCES, ...user.preferences, ...input };
    const updated = await userRepository.update(uid, { preferences } as Partial<User>);
    if (!updated) throw ApiError.notFound('User not found');
    return updated;
  }

  async updateNotificationPreferences(
    uid: string,
    input: UpdateNotificationPreferencesInput,
  ): Promise<User> {
    const user = await this.getProfile(uid);
    const current = user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES;
    const notificationPreferences = {
      pushEnabled: input.pushEnabled ?? current.pushEnabled,
      quietHours: input.quietHours ?? current.quietHours,
      categories: { ...current.categories, ...(input.categories ?? {}) },
    };
    const updated = await userRepository.update(uid, {
      notificationPreferences,
    } as Partial<User>);
    if (!updated) throw ApiError.notFound('User not found');
    return updated;
  }

  async listDevices(uid: string): Promise<DeviceToken[]> {
    return deviceTokenRepository.listTokensForUser(uid);
  }

  async registerDevice(uid: string, input: RegisterDeviceInput): Promise<DeviceToken> {
    return deviceTokenRepository.register(
      uid,
      input.token,
      input.platform,
      input.deviceName,
    );
  }

  async unregisterDevice(uid: string, input: UnregisterDeviceInput): Promise<void> {
    const removed = await deviceTokenRepository.removeToken(uid, input.token);
    if (!removed) throw ApiError.notFound('Device token not found');
  }
}

export const userService = new UserService();
