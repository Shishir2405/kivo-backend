import { z } from 'zod';

import { PAGINATION } from '@/constants';

/** Reusable query schema for offset pagination, coercing string query params. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Path-param schema for endpoints addressing a single resource by id. */
export const idParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});
export type IdParam = z.infer<typeof idParamSchema>;

/** ISO date-time string validator. */
export const isoDateString = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

/** Sort order helper. */
export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');
