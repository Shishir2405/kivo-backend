import { z } from 'zod';

/** `YYYY-MM-DD` day key (matches `dayKey()` from date utils). */
const dayKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dayKey must be in YYYY-MM-DD format');

export const createReflectionSchema = z
  .object({
    dayKey: dayKeySchema,
    learned: z.string().max(10_000).default(''),
    challenged: z.string().max(10_000).default(''),
    goalsCompleted: z.boolean().default(false),
    focusLevel: z.coerce.number().int().min(1).max(5),
    confidence: z.coerce.number().int().min(1).max(5),
    tomorrowPlan: z.string().max(10_000).default(''),
    mood: z.enum(['great', 'good', 'okay', 'low', 'bad']).optional(),
  })
  .strict();
export type CreateReflectionInput = z.infer<typeof createReflectionSchema>;

export const updateReflectionSchema = createReflectionSchema.partial().strict();
export type UpdateReflectionInput = z.infer<typeof updateReflectionSchema>;

export const listReflectionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    /** Free-text search across learned/challenged/tomorrowPlan/dayKey. */
    search: z.string().min(1).max(200).optional(),
    /** Inclusive lower bound on dayKey (`YYYY-MM-DD`). */
    from: dayKeySchema.optional(),
    /** Inclusive upper bound on dayKey (`YYYY-MM-DD`). */
    to: dayKeySchema.optional(),
    goalsCompleted: z.coerce.boolean().optional(),
  })
  .strict();
export type ListReflectionsQuery = z.infer<typeof listReflectionsQuerySchema>;

export const dayKeyParamSchema = z
  .object({
    dayKey: dayKeySchema,
  })
  .strict();
export type DayKeyParam = z.infer<typeof dayKeyParamSchema>;
