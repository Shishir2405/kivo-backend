/**
 * Common, transport-agnostic types shared across layers.
 */

/** Every Firestore document we own carries audit timestamps + id. */
export interface BaseEntity {
  id: string;
  createdAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
}

/** Data needed to create an entity — id/timestamps are assigned by the repository. */
export type CreateInput<T extends BaseEntity> = Omit<T, keyof BaseEntity>;

/** Partial update payload — never allows mutating id/createdAt. */
export type UpdateInput<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/** Authenticated principal attached to every request after auth middleware. */
export interface AuthUser {
  uid: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
}
