import { z } from 'zod';

export const heatmapQuerySchema = z
  .object({
    range: z.enum(['30', '90', '365', 'lifetime']).default('365'),
  })
  .strict();
export type HeatmapQuery = z.infer<typeof heatmapQuerySchema>;

export const weeklyReportQuerySchema = z
  .object({
    /** Any ISO timestamp inside the target week; snapped to the ISO week start. */
    weekStart: z.string().datetime().optional(),
  })
  .strict();
export type WeeklyReportQuery = z.infer<typeof weeklyReportQuerySchema>;
