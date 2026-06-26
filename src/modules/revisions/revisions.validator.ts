import { z } from 'zod';

import {
  ConfidenceRating,
  MAX_REVISION_INTERVALS,
  RevisionEntityType,
  RevisionStatus,
} from '@/constants';

export const scheduleRevisionsSchema = z
  .object({
    entityType: z.nativeEnum(RevisionEntityType),
    entityId: z.string().min(1),
    entityTitle: z.string().min(1).max(200),
    intervals: z
      .array(z.number().int().positive().max(365))
      .min(1)
      .max(MAX_REVISION_INTERVALS)
      .optional(),
  })
  .strict();
export type ScheduleRevisionsInput = z.infer<typeof scheduleRevisionsSchema>;

export const completeRevisionSchema = z
  .object({
    confidence: z.nativeEnum(ConfidenceRating),
    notes: z.string().max(5_000).optional(),
  })
  .strict();
export type CompleteRevisionInput = z.infer<typeof completeRevisionSchema>;

export const snoozeRevisionSchema = z
  .object({
    /** Hours to push the due time forward (default 24). */
    hours: z.number().int().positive().max(24 * 30).default(24),
  })
  .strict();
export type SnoozeRevisionInput = z.infer<typeof snoozeRevisionSchema>;

export const rescheduleRevisionSchema = z
  .object({
    dueAt: z.string().datetime(),
  })
  .strict();
export type RescheduleRevisionInput = z.infer<typeof rescheduleRevisionSchema>;

export const updateRevisionSchema = z
  .object({
    notes: z.string().max(5_000).optional(),
  })
  .strict();
export type UpdateRevisionInput = z.infer<typeof updateRevisionSchema>;

export const listRevisionsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.nativeEnum(RevisionStatus).optional(),
    /** When `true`, return revisions due today (overrides status). */
    today: z.coerce.boolean().optional(),
  })
  .strict();
export type ListRevisionsQuery = z.infer<typeof listRevisionsQuerySchema>;
