import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { DeviceToken } from './notification.types';

/** Data access for FCM device tokens. */
export class DeviceTokenRepository extends UserScopedRepository<DeviceToken> {
  constructor() {
    super(Collections.DEVICE_TOKENS);
  }

  async findByToken(token: string): Promise<DeviceToken | null> {
    return this.findOne({ filters: [{ field: 'token', op: '==', value: token }] });
  }

  async listTokensForUser(userId: string): Promise<DeviceToken[]> {
    return this.listForUser(userId);
  }

  /**
   * Upsert a token for a user (idempotent registration). If the token already
   * exists, refresh its `lastUsedAt`/owner; otherwise create it.
   */
  async register(
    userId: string,
    token: string,
    platform: DeviceToken['platform'],
    deviceName?: string,
  ): Promise<DeviceToken> {
    const now = new Date().toISOString();
    const existing = await this.findByToken(token);
    if (existing) {
      const patch: Partial<DeviceToken> = { userId, platform, lastUsedAt: now };
      if (deviceName !== undefined) patch.deviceName = deviceName;
      const updated = await this.update(existing.id, patch);
      return updated ?? existing;
    }
    const createPayload: Parameters<DeviceTokenRepository['create']>[0] = {
      userId,
      token,
      platform,
      lastUsedAt: now,
    };
    if (deviceName !== undefined) createPayload.deviceName = deviceName;
    return this.create(createPayload);
  }

  async removeToken(userId: string, token: string): Promise<boolean> {
    const existing = await this.findByToken(token);
    if (!existing || existing.userId !== userId) return false;
    return this.delete(existing.id);
  }

  /** Delete tokens FCM reported as invalid/unregistered. */
  async pruneTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    const docs = await Promise.all(tokens.map((t) => this.findByToken(t)));
    await Promise.all(
      docs.filter((d): d is DeviceToken => d !== null).map((d) => this.delete(d.id)),
    );
  }
}

export const deviceTokenRepository = new DeviceTokenRepository();
