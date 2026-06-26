import { z } from 'zod';

/** The full set of recognised achievement keys. */
export const achievementKeySchema = z.enum([
  'first_week',
  'thirty_days',
  'hundred_days',
  'one_year',
]);
export type AchievementKeyInput = z.infer<typeof achievementKeySchema>;
