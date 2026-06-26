import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';
import { isPast } from '@/utils/dates';

import type { RefreshTokenRecord } from './auth.types';

/** Data access for hashed refresh tokens. */
export class RefreshTokenRepository extends UserScopedRepository<RefreshTokenRecord> {
  constructor() {
    super(Collections.REFRESH_TOKENS);
  }

  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return this.findOne({ filters: [{ field: 'tokenHash', op: '==', value: tokenHash }] });
  }

  /** Revoke (delete) a single token by its hash. */
  async revokeByHash(tokenHash: string): Promise<boolean> {
    const record = await this.findByHash(tokenHash);
    if (!record) return false;
    return this.delete(record.id);
  }

  /** Revoke every refresh token for a user (logout-all / forced re-auth). */
  async revokeAllForUser(userId: string): Promise<number> {
    const records = await this.listForUser(userId);
    await Promise.all(records.map((r) => this.delete(r.id)));
    return records.length;
  }

  /** Delete tokens whose `expiresAt` is in the past. Returns the count removed. */
  async deleteExpired(): Promise<number> {
    const nowIso = new Date().toISOString();
    const expired = await this.find({
      filters: [{ field: 'expiresAt', op: '<', value: nowIso }],
    });
    // Defensive double-check against clock skew on the value comparison.
    const toDelete = expired.filter((r) => isPast(r.expiresAt));
    await Promise.all(toDelete.map((r) => this.delete(r.id)));
    return toDelete.length;
  }
}

export const refreshTokenRepository = new RefreshTokenRepository();
