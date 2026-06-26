import { StatusCodes } from 'http-status-codes';
import { getAuth, type DecodedIdToken, type UserRecord } from 'firebase-admin/auth';

import { ApiError } from '@/utils/ApiError';
import { createLogger } from '@/utils/logger';

import { getFirebaseApp } from './admin';

const log = createLogger('firebase-auth');

export function auth() {
  return getAuth(getFirebaseApp());
}

/**
 * Verify a Firebase ID token issued to the mobile client.
 * Throws a 401 ApiError on any verification failure (expired/invalid/revoked).
 */
export async function verifyIdToken(idToken: string, checkRevoked = true): Promise<DecodedIdToken> {
  try {
    return await auth().verifyIdToken(idToken, checkRevoked);
  } catch (err) {
    log.debug({ err }, 'ID token verification failed');
    throw ApiError.unauthorized('Invalid or expired authentication token');
  }
}

export async function getUserByUid(uid: string): Promise<UserRecord> {
  try {
    return await auth().getUser(uid);
  } catch (err) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found', {
      code: 'NOT_FOUND',
      cause: err,
    });
  }
}

export async function getUserByEmail(email: string): Promise<UserRecord | null> {
  try {
    return await auth().getUserByEmail(email);
  } catch {
    return null;
  }
}

/**
 * Attach custom claims (e.g. role) to a Firebase user. These propagate into future
 * ID tokens and are read back during verification for authorization.
 */
export async function setUserClaims(uid: string, claims: Record<string, unknown>): Promise<void> {
  await auth().setCustomUserClaims(uid, claims);
}

/** Revoke all refresh tokens for a user (forces re-auth on every device). */
export async function revokeUserSessions(uid: string): Promise<void> {
  await auth().revokeRefreshTokens(uid);
}
