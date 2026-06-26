import { StatusCodes } from 'http-status-codes';

export interface ApiErrorDetail {
  field?: string;
  message: string;
  code?: string;
}

/**
 * Operational error type carried through the app. The error middleware converts these
 * into clean JSON responses. `isOperational` distinguishes expected failures (bad input,
 * not found, unauthorised) from programmer errors / unexpected crashes.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: ApiErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    options: {
      code?: string;
      isOperational?: boolean;
      details?: ApiErrorDetail[];
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = options.code ?? deriveCode(statusCode);
    this.isOperational = options.isOperational ?? true;
    if (options.details) this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;

    Error.captureStackTrace(this, this.constructor);
  }

  // ── Convenience factories ──────────────────────────────────────────────

  static badRequest(message = 'Bad request', details?: ApiErrorDetail[]): ApiError {
    return new ApiError(StatusCodes.BAD_REQUEST, message, { code: 'BAD_REQUEST', details });
  }

  static unauthorized(message = 'Authentication required'): ApiError {
    return new ApiError(StatusCodes.UNAUTHORIZED, message, { code: 'UNAUTHORIZED' });
  }

  static forbidden(message = 'You do not have permission to perform this action'): ApiError {
    return new ApiError(StatusCodes.FORBIDDEN, message, { code: 'FORBIDDEN' });
  }

  static notFound(message = 'Resource not found'): ApiError {
    return new ApiError(StatusCodes.NOT_FOUND, message, { code: 'NOT_FOUND' });
  }

  static conflict(message = 'Resource conflict'): ApiError {
    return new ApiError(StatusCodes.CONFLICT, message, { code: 'CONFLICT' });
  }

  static unprocessable(message = 'Validation failed', details?: ApiErrorDetail[]): ApiError {
    return new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, message, {
      code: 'VALIDATION_ERROR',
      details,
    });
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(StatusCodes.TOO_MANY_REQUESTS, message, { code: 'RATE_LIMITED' });
  }

  static internal(message = 'Internal server error', cause?: unknown): ApiError {
    return new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, message, {
      code: 'INTERNAL_ERROR',
      isOperational: false,
      cause,
    });
  }

  static serviceUnavailable(message = 'Service temporarily unavailable'): ApiError {
    return new ApiError(StatusCodes.SERVICE_UNAVAILABLE, message, {
      code: 'SERVICE_UNAVAILABLE',
    });
  }
}

function deriveCode(statusCode: number): string {
  switch (statusCode) {
    case StatusCodes.BAD_REQUEST:
      return 'BAD_REQUEST';
    case StatusCodes.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case StatusCodes.FORBIDDEN:
      return 'FORBIDDEN';
    case StatusCodes.NOT_FOUND:
      return 'NOT_FOUND';
    case StatusCodes.CONFLICT:
      return 'CONFLICT';
    case StatusCodes.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_ERROR';
    case StatusCodes.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    default:
      return statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}

/** Type guard used by the error middleware. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
