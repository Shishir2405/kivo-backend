import type { NextFunction, Request, Response } from 'express';

import type { AuthUser } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { verifyAccessToken } from '@/utils/jwt';

function extractBearerToken(req: Request): string | null {
  const header = req.header('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

function toAuthUser(claims: ReturnType<typeof verifyAccessToken>): AuthUser {
  return {
    uid: claims.uid,
    email: claims.email ?? null,
    role: claims.role,
    emailVerified: Boolean((claims as { emailVerified?: boolean }).emailVerified),
  };
}

/**
 * Require a valid backend access JWT. Populates `req.user`. 401 on missing/invalid.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next(ApiError.unauthorized('Authentication required'));
    return;
  }
  try {
    req.user = toAuthUser(verifyAccessToken(token));
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Populate `req.user` if a valid token is present, but never reject the request.
 * Used for endpoints whose behaviour differs for authenticated vs anonymous callers.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req);
  if (!token) {
    next();
    return;
  }
  try {
    req.user = toAuthUser(verifyAccessToken(token));
  } catch {
    // Ignore — caller is treated as anonymous.
  }
  next();
}

/**
 * Role-based access guard. Must run after {@link authenticate}.
 *
 *   router.delete('/:id', authenticate, authorize('admin'), handler)
 */
export function authorize(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(ApiError.unauthorized('Authentication required'));
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(ApiError.forbidden('You do not have permission to perform this action'));
      return;
    }
    next();
  };
}

/** Convenience accessor that asserts the request is authenticated. */
export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw ApiError.unauthorized('Authentication required');
  }
  return req.user;
}
