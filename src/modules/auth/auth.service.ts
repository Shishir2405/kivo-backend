import { createHash } from 'node:crypto';

import { UserRole } from '@/constants';
import { setUserClaims, verifyIdToken } from '@/firebase/auth';
import type { CreateInput } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { addDays, nowIso } from '@/utils/dates';
import { issueTokenPair, verifyRefreshToken } from '@/utils/jwt';
import { createLogger } from '@/utils/logger';

import { userRepository } from '../users/users.repository';
import type { User } from '../users/users.types';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  DEFAULT_USER_PREFERENCES,
} from '../users/users.types';
import type { AuthResult, AuthTokens, RefreshTokenRecord } from './auth.types';
import { refreshTokenRepository } from './refreshToken.repository';

const log = createLogger('auth-service');

/** Days a refresh token stays valid (must align with JWT_REFRESH_EXPIRES_IN policy). */
const REFRESH_TOKEN_TTL_DAYS = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export class AuthService {
  /**
   * Register: verify the Firebase ID token, create-or-sync the user doc, set role
   * custom claims, and issue a backend token pair. Idempotent — calling register on
   * an existing user behaves like login but ensures the doc exists.
   */
  async register(idToken: string, userAgent?: string): Promise<AuthResult> {
    const decoded = await verifyIdToken(idToken);
    const user = await this.syncUser(decoded.uid, {
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoUrl: decoded.picture ?? null,
      emailVerified: Boolean(decoded.email_verified),
    });
    const tokens = await this.issueSession(user, userAgent);
    return { user, tokens };
  }

  /** Login: verify the Firebase ID token, sync the user doc, issue a token pair. */
  async login(idToken: string, userAgent?: string): Promise<AuthResult> {
    const decoded = await verifyIdToken(idToken);
    const user = await this.syncUser(decoded.uid, {
      email: decoded.email ?? null,
      displayName: decoded.name ?? null,
      photoUrl: decoded.picture ?? null,
      emailVerified: Boolean(decoded.email_verified),
      lastLoginAt: nowIso(),
    });
    const tokens = await this.issueSession(user, userAgent);
    return { user, tokens };
  }

  /**
   * Refresh: verify the refresh JWT, confirm the hashed token is on record and not
   * expired/revoked, then rotate it (delete old, issue new) — single-use rotation.
   */
  async refresh(refreshToken: string, userAgent?: string): Promise<AuthTokens> {
    const claims = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const record = await refreshTokenRepository.findByHash(tokenHash);
    if (!record || record.revokedAt) {
      throw ApiError.unauthorized('Refresh token is no longer valid');
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await refreshTokenRepository.delete(record.id);
      throw ApiError.unauthorized('Refresh token has expired');
    }

    const user = await userRepository.findByUid(claims.uid);
    if (!user) {
      throw ApiError.unauthorized('User no longer exists');
    }

    // Rotate: invalidate the used token, issue a fresh pair.
    await refreshTokenRepository.delete(record.id);
    return this.issueSession(user, userAgent);
  }

  /** Logout: revoke a single refresh token, or every session when `allDevices`. */
  async logout(
    uid: string,
    options: { refreshToken?: string; allDevices?: boolean } = {},
  ): Promise<void> {
    if (options.allDevices) {
      await refreshTokenRepository.revokeAllForUser(uid);
      return;
    }
    if (options.refreshToken) {
      await refreshTokenRepository.revokeByHash(hashToken(options.refreshToken));
    }
  }

  async me(uid: string): Promise<User> {
    const user = await userRepository.findByUid(uid);
    if (!user) throw ApiError.notFound('User not found');
    return user;
  }

  /** Maintenance job entrypoint: purge expired refresh tokens. */
  async cleanupExpiredRefreshTokens(): Promise<number> {
    return refreshTokenRepository.deleteExpired();
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** Create or update the user document from verified Firebase identity data. */
  private async syncUser(
    uid: string,
    data: {
      email: string | null;
      displayName: string | null;
      photoUrl: string | null;
      emailVerified: boolean;
      lastLoginAt?: string;
    },
  ): Promise<User> {
    const existing = await userRepository.findByUid(uid);

    if (existing) {
      const patch: Partial<User> = {
        email: data.email,
        emailVerified: data.emailVerified,
      };
      if (data.displayName !== null) patch.displayName = data.displayName;
      if (data.photoUrl !== null) patch.photoUrl = data.photoUrl;
      if (data.lastLoginAt) patch.lastLoginAt = data.lastLoginAt;
      const updated = await userRepository.update(uid, patch);
      return updated ?? existing;
    }

    const payload: CreateInput<User> = {
      uid,
      email: data.email,
      displayName: data.displayName,
      photoUrl: data.photoUrl,
      role: UserRole.STUDENT,
      emailVerified: data.emailVerified,
      preferences: { ...DEFAULT_USER_PREFERENCES },
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      currentStreak: 0,
      longestStreak: 0,
      lastActiveDay: null,
      xp: 0,
      lastLoginAt: data.lastLoginAt ?? nowIso(),
    };
    const created = await userRepository.create(payload, uid);

    // Propagate role into Firebase custom claims for downstream ID-token checks.
    await setUserClaims(uid, { role: UserRole.STUDENT }).catch((err) => {
      log.warn({ err, uid }, 'Failed to set custom claims (continuing)');
    });

    return created;
  }

  /** Issue an access+refresh pair and persist the hashed refresh token. */
  private async issueSession(user: User, userAgent?: string): Promise<AuthTokens> {
    const tokens = issueTokenPair({
      uid: user.uid,
      email: user.email,
      role: user.role,
    });

    const record: CreateInput<RefreshTokenRecord> = {
      userId: user.uid,
      tokenHash: hashToken(tokens.refreshToken),
      expiresAt: addDays(REFRESH_TOKEN_TTL_DAYS),
    };
    if (userAgent) record.userAgent = userAgent;
    await refreshTokenRepository.create(record);

    return tokens;
  }
}

export const authService = new AuthService();
