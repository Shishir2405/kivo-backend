import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod';

import { config } from '@/config';
import type { ApiErrorDetail } from '@/utils/ApiError';
import { ApiError, isApiError } from '@/utils/ApiError';
import { logger } from '@/utils/logger';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
    requestId: string;
  };
}

/** Firebase Admin auth errors carry a `code` like `auth/id-token-expired`. */
function isFirebaseAuthError(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    (err as { code: string }).code.startsWith('auth/')
  );
}

function zodToApiError(err: ZodError): ApiError {
  return ApiError.unprocessable(
    'Validation failed',
    err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
  );
}

/**
 * Central error handler. Must be registered LAST. Normalises every thrown value
 * into the canonical error envelope and decides what (if anything) to leak.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  let apiError: ApiError;

  if (isApiError(err)) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = zodToApiError(err);
  } else if (isFirebaseAuthError(err)) {
    apiError = ApiError.unauthorized('Invalid or expired authentication token');
  } else {
    apiError = ApiError.internal(
      err instanceof Error ? err.message : 'Unexpected error',
      err,
    );
  }

  const requestId = req.id ? String(req.id) : '';

  // Log server-side faults (5xx / non-operational) with full context.
  if (apiError.statusCode >= StatusCodes.INTERNAL_SERVER_ERROR || !apiError.isOperational) {
    logger.error(
      { err, requestId, statusCode: apiError.statusCode },
      `Unhandled error: ${apiError.message}`,
    );
  } else {
    logger.debug(
      { requestId, statusCode: apiError.statusCode, code: apiError.code },
      apiError.message,
    );
  }

  // Never leak internal error messages in production.
  const exposeMessage =
    apiError.isOperational || !config.isProduction
      ? apiError.message
      : 'Internal server error';

  const body: ErrorBody = {
    success: false,
    error: {
      code: apiError.code,
      message: exposeMessage,
      requestId,
    },
  };
  if (apiError.details && apiError.details.length > 0) {
    body.error.details = apiError.details;
  }

  if (res.headersSent) {
    return;
  }
  res.status(apiError.statusCode).json(body);
}
