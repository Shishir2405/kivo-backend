import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

import type { ApiErrorDetail } from '@/utils/ApiError';
import { ApiError } from '@/utils/ApiError';

export type ValidationSource = 'body' | 'query' | 'params';

/** Combined-schema form: validate any subset of body/query/params in one middleware. */
export interface CombinedSchema {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

function zodToDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

function isCombinedSchema(schema: ZodTypeAny | CombinedSchema): schema is CombinedSchema {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    !('parse' in schema) &&
    ('body' in schema || 'query' in schema || 'params' in schema)
  );
}

/**
 * Validate (and coerce) a request segment against a Zod schema, replacing the raw
 * input with the parsed value so handlers get fully-typed, trusted data. Supports
 * both a single-schema + source form and a `{ body?, query?, params? }` form.
 *
 * On failure throws `ApiError.unprocessable` (422) with field-level `details`.
 */
export function validate(
  schema: ZodTypeAny | CombinedSchema,
  source: ValidationSource = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (isCombinedSchema(schema)) {
        if (schema.params) req.params = schema.params.parse(req.params) as typeof req.params;
        if (schema.query) {
          Object.defineProperty(req, 'query', {
            value: schema.query.parse(req.query),
            configurable: true,
            enumerable: true,
            writable: true,
          });
        }
        if (schema.body) req.body = schema.body.parse(req.body);
      } else {
        const parsed = schema.parse(req[source]);
        if (source === 'query') {
          // In Express 5 `req.query` is a getter; redefine instead of assign.
          Object.defineProperty(req, 'query', {
            value: parsed,
            configurable: true,
            enumerable: true,
            writable: true,
          });
        } else {
          req[source] = parsed as never;
        }
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(ApiError.unprocessable('Validation failed', zodToDetails(err)));
        return;
      }
      next(err);
    }
  };
}

export { zodToDetails };
