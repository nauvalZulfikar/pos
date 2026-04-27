import { describe, expect, it } from 'vitest';
import {
  FeatureNotEnabledError,
  PermissionDeniedError,
  ProblemError,
  TenantMismatchError,
} from './errors.js';

describe('ProblemError', () => {
  it('serializes to RFC 7807 with type URL and code', () => {
    const err = new ProblemError(404, 'NOT_FOUND', 'Order missing.');
    const p = err.toProblem();
    expect(p.status).toBe(404);
    expect(p.code).toBe('NOT_FOUND');
    expect(p.detail).toBe('Order missing.');
    expect(p.type).toContain('not-found');
  });

  it('includes extra fields', () => {
    const err = new ProblemError(400, 'VALIDATION_FAILED', 'bad', { field: 'email' });
    const p = err.toProblem();
    expect((p as unknown as { field: string }).field).toBe('email');
  });

  it('FeatureNotEnabledError attaches feature code', () => {
    const err = new FeatureNotEnabledError('qris_native');
    expect(err.status).toBe(403);
    expect(err.code).toBe('FEATURE_NOT_ENABLED');
    expect(err.extra.feature).toBe('qris_native');
  });

  it('TenantMismatchError uses 403 + standard code', () => {
    const err = new TenantMismatchError();
    expect(err.status).toBe(403);
    expect(err.code).toBe('TENANT_MISMATCH');
  });

  it('PermissionDeniedError carries permission name', () => {
    const err = new PermissionDeniedError('order:void');
    expect(err.extra.permission).toBe('order:void');
  });
});
