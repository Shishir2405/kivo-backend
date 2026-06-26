import type { BaseEntity } from '@/types';

import type { User } from '../users/users.types';

/** A persisted, hashed refresh token (one per device session). */
export interface RefreshTokenRecord extends BaseEntity {
  userId: string;
  /** SHA-256 hash of the refresh token — the raw token is never stored. */
  tokenHash: string;
  expiresAt: string;
  /** Optional metadata for session listing/auditing. */
  userAgent?: string;
  revokedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
}
