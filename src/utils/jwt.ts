import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';

import { config } from '@/config';
import { ApiError, isApiError } from '@/utils/ApiError';

/**
 * Backend session-token claims. These are *our* tokens (not Firebase ID tokens) —
 * short-lived access tokens + long-lived refresh tokens, issued after we verify a
 * Firebase ID token at login/register.
 */
export interface SessionTokenPayload {
  uid: string;
  email: string | null;
  role: string;
}

export interface SessionTokenClaims extends SessionTokenPayload, JwtPayload {
  /** Token flavour, so a refresh token can never be used as an access token. */
  type: 'access' | 'refresh';
}

const baseSignOptions = {
  issuer: config.jwt.issuer,
  audience: config.jwt.audience,
} satisfies SignOptions;

function sign(payload: SessionTokenPayload, type: 'access' | 'refresh'): string {
  const secret = type === 'access' ? config.jwt.accessSecret : config.jwt.refreshSecret;
  const expiresIn = type === 'access' ? config.jwt.accessExpiresIn : config.jwt.refreshExpiresIn;

  // `expiresIn` is sourced from validated env (string like "15m"/"30d"); the
  // @types/jsonwebtoken `StringValue` template type can't represent an arbitrary
  // string, so we widen via the documented `number | string` runtime contract.
  const options: SignOptions = {
    ...baseSignOptions,
    expiresIn: expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign({ uid: payload.uid, email: payload.email, role: payload.role, type }, secret, options);
}

export function signAccessToken(payload: SessionTokenPayload): string {
  return sign(payload, 'access');
}

export function signRefreshToken(payload: SessionTokenPayload): string {
  return sign(payload, 'refresh');
}

function verify(token: string, type: 'access' | 'refresh'): SessionTokenClaims {
  const secret = type === 'access' ? config.jwt.accessSecret : config.jwt.refreshSecret;
  try {
    const decoded = jwt.verify(token, secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    });

    if (typeof decoded === 'string') {
      throw ApiError.unauthorized('Malformed authentication token');
    }

    const claims = decoded as SessionTokenClaims;
    if (claims.type !== type) {
      throw ApiError.unauthorized('Invalid token type');
    }
    return claims;
  } catch (err) {
    if (isApiError(err)) {
      throw err;
    }
    if (err instanceof jwt.TokenExpiredError) {
      throw ApiError.unauthorized('Authentication token has expired');
    }
    throw ApiError.unauthorized('Invalid authentication token');
  }
}

export function verifyAccessToken(token: string): SessionTokenClaims {
  return verify(token, 'access');
}

export function verifyRefreshToken(token: string): SessionTokenClaims {
  return verify(token, 'refresh');
}

/** Issue both tokens at once for the common login/register/refresh flow. */
export function issueTokenPair(payload: SessionTokenPayload): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
