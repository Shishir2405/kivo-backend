import { z } from 'zod';

import { NotificationType } from '@/constants';

export const updateProfileSchema = z
  .object({
    displayName: z.string().min(1).max(120).nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
  })
  .strict();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    dailyStudyGoalMinutes: z.number().int().min(0).max(1_440).optional(),
    dailyProblemGoal: z.number().int().min(0).max(100).optional(),
    reminderHour: z.number().int().min(0).max(23).optional(),
    timezone: z.string().min(1).max(64).optional(),
  })
  .strict();
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

const quietHoursSchema = z
  .object({
    enabled: z.boolean(),
    startHour: z.number().int().min(0).max(23),
    endHour: z.number().int().min(0).max(23),
  })
  .strict();

export const updateNotificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    quietHours: quietHoursSchema.optional(),
    categories: z
      .record(z.nativeEnum(NotificationType), z.boolean())
      .optional(),
  })
  .strict();
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>;

export const registerDeviceSchema = z
  .object({
    token: z.string().min(1),
    platform: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().min(1).max(120).optional(),
  })
  .strict();
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const unregisterDeviceSchema = z
  .object({
    token: z.string().min(1),
  })
  .strict();
export type UnregisterDeviceInput = z.infer<typeof unregisterDeviceSchema>;
