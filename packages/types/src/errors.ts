import { z } from 'zod';

/** RFC 7807 Problem Details — the wire format for every API error. */
export const ProblemDetails = z.object({
  type: z.string().url(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: z.string(),
}).catchall(z.unknown());
export type ProblemDetails = z.infer<typeof ProblemDetails>;

export const ErrorCode = z.enum([
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'PERMISSION_DENIED',
  'TENANT_MISMATCH',
  'FEATURE_NOT_ENABLED',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'IDEMPOTENCY_REPLAYED',
  'INTERNAL',
  'UPSTREAM_FAILED',
  'OFFLINE_OP_REJECTED',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export class ProblemError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    public override readonly message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ProblemError';
  }

  toProblem(): ProblemDetails {
    return {
      type: `https://docs.desain.id/errors/${this.code.toLowerCase().replace(/_/g, '-')}`,
      title: this.code.replace(/_/g, ' ').toLowerCase(),
      status: this.status,
      detail: this.message,
      code: this.code,
      ...this.extra,
    };
  }
}

export class FeatureNotEnabledError extends ProblemError {
  constructor(feature: string) {
    super(403, 'FEATURE_NOT_ENABLED', `Feature '${feature}' is not enabled for this tenant.`, {
      feature,
    });
  }
}

export class TenantMismatchError extends ProblemError {
  constructor() {
    super(403, 'TENANT_MISMATCH', 'Resource does not belong to current tenant.');
  }
}

export class PermissionDeniedError extends ProblemError {
  constructor(permission: string) {
    super(403, 'PERMISSION_DENIED', `Missing permission '${permission}'.`, { permission });
  }
}
