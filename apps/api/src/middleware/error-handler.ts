import { ProblemError } from '@desain/types';
import { ZodError } from 'zod';
import type { ErrorHandler } from 'hono';
import { logger } from '../logger.js';
import type { RequestVars } from '../context.js';

export const errorHandler: ErrorHandler<{ Variables: RequestVars }> = (err, c) => {
  if (err instanceof ProblemError) {
    return c.json(err.toProblem(), err.status as 400 | 401 | 403 | 404 | 409 | 429 | 500);
  }
  if (err instanceof ZodError) {
    return c.json(
      {
        type: 'https://docs.desain.id/errors/validation-failed',
        title: 'validation failed',
        status: 400,
        detail: 'Request body or query failed schema validation.',
        code: 'VALIDATION_FAILED',
        issues: err.issues,
      },
      400,
    );
  }
  logger.error({ err, requestId: c.get('requestId') }, 'unhandled error');
  return c.json(
    {
      type: 'https://docs.desain.id/errors/internal',
      title: 'internal error',
      status: 500,
      detail: process.env.NODE_ENV === 'production' ? 'Server error.' : (err instanceof Error ? err.message : String(err)),
      code: 'INTERNAL',
    },
    500,
  );
};
