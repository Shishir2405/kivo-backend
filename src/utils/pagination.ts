import { PAGINATION } from '@/constants';
import type { PaginatedResult, PaginationParams } from '@/types';

/**
 * Normalise raw pagination query input into safe, clamped values.
 */
export function resolvePagination(input: {
  page?: number | string | undefined;
  limit?: number | string | undefined;
}): PaginationParams {
  const page = Math.max(PAGINATION.DEFAULT_PAGE, toInt(input.page, PAGINATION.DEFAULT_PAGE));
  const limit = clamp(toInt(input.limit, PAGINATION.DEFAULT_LIMIT), 1, PAGINATION.MAX_LIMIT);
  return { page, limit };
}

export function paginationOffset({ page, limit }: PaginationParams): number {
  return (page - 1) * limit;
}

/**
 * Build a paginated envelope from a page of items and a total count.
 */
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  { page, limit }: PaginationParams,
): PaginatedResult<T> {
  const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

function toInt(value: number | string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = typeof value === 'number' ? value : Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
