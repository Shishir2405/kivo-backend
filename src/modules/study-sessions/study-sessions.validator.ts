import { z } from 'zod';

const timerTypeSchema = z.enum([
  'pomodoro',
  'deep_focus',
  'stopwatch',
  'countdown',
  'custom',
]);

export const createStudySessionSchema = z
  .object({
    timerType: timerTypeSchema,
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    durationMinutes: z.number().int().nonnegative().max(1_440),
    topicId: z.string().min(1).max(200).optional(),
    topicName: z.string().min(1).max(200).optional(),
    notes: z.string().max(5_000).optional(),
    interruptions: z.number().int().nonnegative().max(1_000).default(0),
  })
  .strict();
export type CreateStudySessionInput = z.infer<typeof createStudySessionSchema>;

export const updateStudySessionSchema = createStudySessionSchema.partial().strict();
export type UpdateStudySessionInput = z.infer<typeof updateStudySessionSchema>;

export const listStudySessionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    timerType: timerTypeSchema.optional(),
    topicId: z.string().min(1).max(200).optional(),
    /** Inclusive lower bound on `startTime` (ISO-8601). */
    from: z.string().datetime().optional(),
    /** Inclusive upper bound on `startTime` (ISO-8601). */
    to: z.string().datetime().optional(),
  })
  .strict();
export type ListStudySessionsQuery = z.infer<typeof listStudySessionsQuerySchema>;
