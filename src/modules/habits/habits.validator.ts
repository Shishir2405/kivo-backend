import { z } from 'zod';

/** ISO weekday (1 = Monday … 7 = Sunday). */
const weekdaySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
]);

/** Local reminder time as `HH:mm` (24h). */
const reminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'reminderTime must be HH:mm');

export const createHabitSchema = z
  .object({
    name: z.string().min(1).max(120),
    emoji: z.string().min(1).max(16).default('✅'),
    color: z.string().min(1).max(32).default('#6366f1'),
    frequency: z.enum(['daily', 'weekly', 'custom']).default('daily'),
    daysOfWeek: z.array(weekdaySchema).max(7).default([]),
    targetPerPeriod: z.number().int().positive().max(100).default(1),
    reminderTime: reminderTimeSchema.optional(),
    isArchived: z.boolean().default(false),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.frequency === 'custom' && val.daysOfWeek.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['daysOfWeek'],
        message: 'custom frequency requires at least one weekday',
      });
    }
  });
export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    emoji: z.string().min(1).max(16).optional(),
    color: z.string().min(1).max(32).optional(),
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    daysOfWeek: z.array(weekdaySchema).max(7).optional(),
    targetPerPeriod: z.number().int().positive().max(100).optional(),
    reminderTime: reminderTimeSchema.optional(),
    isArchived: z.boolean().optional(),
  })
  .strict();
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

export const listHabitsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    frequency: z.enum(['daily', 'weekly', 'custom']).optional(),
    archived: z.coerce.boolean().optional(),
  })
  .strict();
export type ListHabitsQuery = z.infer<typeof listHabitsQuerySchema>;

/** Body for logging/removing a completion for a specific day. */
export const completeHabitSchema = z
  .object({
    /** Day to log against (`YYYY-MM-DD`). Defaults to today server-side. */
    dayKey: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dayKey must be YYYY-MM-DD')
      .optional(),
    /** How many completions to log (defaults to 1). */
    count: z.number().int().positive().max(100).default(1),
  })
  .strict();
export type CompleteHabitInput = z.infer<typeof completeHabitSchema>;
