/**
 * Server-side op applier. AGENTS.md §8.4.
 *
 * Idempotent: if the same `client_op_id` arrives twice, the second is a no-op
 * and we return `duplicate` with the originally-applied state.
 *
 * The applier is intentionally agnostic to a specific db client — callers pass
 * a `Repository` so this file is testable against an in-memory store.
 */

import type { Op, OpResult, SyncResponse } from '@desain/types';

export type CanonicalRow = { kind: string; row: Record<string, unknown> };

export type ApplierContext = {
  tenantId: string;
  outletId: string;
  shiftId: string | null;
  userId: string;
  deviceId: string;
};

export type Repository = {
  findOp: (clientOpId: string) => Promise<{ status: 'applied'; receivedAt: string } | null>;
  recordOp: (op: Op) => Promise<void>;
  apply: (op: Op, ctx: ApplierContext) => Promise<{ canonical: CanonicalRow[] }>;
};

export type ApplyOptions = {
  /**
   * Reject ops older than this many minutes. Stale ops can occur if a terminal was
   * offline for days. Default 14 days. Set to null to disable.
   */
  maxAgeMinutes?: number | null;
};

const DEFAULT_MAX_AGE_MINUTES = 14 * 24 * 60;

export async function applyBatch(
  repo: Repository,
  ops: readonly Op[],
  ctx: ApplierContext,
  opts: ApplyOptions = {},
): Promise<SyncResponse> {
  const now = new Date();
  const results: OpResult[] = [];

  for (const op of ops) {
    const result = await applySingle(repo, op, ctx, now, opts);
    results.push(result);
  }

  return { results, serverNow: now.toISOString() };
}

async function applySingle(
  repo: Repository,
  op: Op,
  ctx: ApplierContext,
  now: Date,
  opts: ApplyOptions,
): Promise<OpResult> {
  // Tenant guard — defence in depth (RLS is the primary).
  if (op.tenantId !== ctx.tenantId) {
    return {
      clientOpId: op.clientOpId,
      status: 'rejected',
      code: 'TENANT_MISMATCH',
      detail: 'op.tenantId does not match request context',
    };
  }
  if (op.outletId !== ctx.outletId) {
    return {
      clientOpId: op.clientOpId,
      status: 'rejected',
      code: 'OUTLET_MISMATCH',
      detail: 'op.outletId does not match request context',
    };
  }

  const maxAge = opts.maxAgeMinutes === null ? null : (opts.maxAgeMinutes ?? DEFAULT_MAX_AGE_MINUTES);
  if (maxAge !== null) {
    const ageMin = (now.getTime() - new Date(op.clientAt).getTime()) / 60_000;
    if (ageMin > maxAge) {
      return {
        clientOpId: op.clientOpId,
        status: 'rejected',
        code: 'OP_TOO_OLD',
        detail: `op older than ${maxAge} minutes (${ageMin.toFixed(1)})`,
      };
    }
  }

  // Idempotency check.
  const existing = await repo.findOp(op.clientOpId);
  if (existing) {
    return { clientOpId: op.clientOpId, status: 'duplicate', receivedAt: existing.receivedAt };
  }

  try {
    const { canonical } = await repo.apply(op, ctx);
    await repo.recordOp(op);
    return {
      clientOpId: op.clientOpId,
      status: 'applied',
      receivedAt: now.toISOString(),
      canonical,
    };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'APPLY_FAILED';
    const detail = err instanceof Error ? err.message : String(err);
    return { clientOpId: op.clientOpId, status: 'rejected', code, detail };
  }
}
