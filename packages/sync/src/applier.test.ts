import { describe, expect, it } from 'vitest';
import type { Op } from '@desain/types';
import { applyBatch } from './server/applier.js';
import type { ApplierContext, CanonicalRow, Repository } from './server/applier.js';

const ctx: ApplierContext = {
  tenantId: '01910000-0000-7000-8000-000000000001',
  outletId: '01910000-0000-7000-8000-000000000002',
  shiftId: '01910000-0000-7000-8000-000000000003',
  userId: '01910000-0000-7000-8000-000000000004',
  deviceId: '01910000-0000-7000-8000-000000000005',
};

function makeOp(clientOpId: string, type: Op['type'] = 'order.create', clientAt = new Date().toISOString()): Op {
  return {
    clientOpId: clientOpId as Op['clientOpId'],
    tenantId: ctx.tenantId as Op['tenantId'],
    outletId: ctx.outletId as Op['outletId'],
    shiftId: ctx.shiftId as Op['shiftId'],
    userId: ctx.userId as Op['userId'],
    deviceId: ctx.deviceId as Op['deviceId'],
    type,
    payload: { foo: 'bar' },
    clientAt,
  };
}

function makeRepo(opts: { applyImpl?: (op: Op) => Promise<{ canonical: CanonicalRow[] }> } = {}): Repository {
  const ops = new Map<string, { receivedAt: string }>();
  return {
    findOp: async (id) => (ops.has(id) ? { status: 'applied', receivedAt: ops.get(id)!.receivedAt } : null),
    recordOp: async (op) => {
      ops.set(op.clientOpId, { receivedAt: new Date().toISOString() });
    },
    apply:
      opts.applyImpl ??
      (async (op) => ({
        canonical: [{ kind: op.type.split('.')[0]!, row: { id: op.clientOpId, tenant_id: op.tenantId } }],
      })),
  };
}

describe('applyBatch', () => {
  it('applies a fresh op', async () => {
    const repo = makeRepo();
    const op = makeOp('01910000-0000-7000-8000-00000000000a');
    const r = await applyBatch(repo, [op], ctx);
    expect(r.results[0]!.status).toBe('applied');
  });

  it('detects duplicate on retry (idempotent)', async () => {
    const repo = makeRepo();
    const op = makeOp('01910000-0000-7000-8000-00000000000b');
    await applyBatch(repo, [op], ctx);
    const r2 = await applyBatch(repo, [op], ctx);
    expect(r2.results[0]!.status).toBe('duplicate');
  });

  it('rejects mismatched tenant', async () => {
    const repo = makeRepo();
    const op = makeOp('01910000-0000-7000-8000-00000000000c');
    op.tenantId = '01910000-0000-7000-8000-000000000099' as Op['tenantId'];
    const r = await applyBatch(repo, [op], ctx);
    expect(r.results[0]!.status).toBe('rejected');
    if (r.results[0]!.status === 'rejected') {
      expect(r.results[0]!.code).toBe('TENANT_MISMATCH');
    }
  });

  it('rejects mismatched outlet', async () => {
    const repo = makeRepo();
    const op = makeOp('01910000-0000-7000-8000-00000000000d');
    op.outletId = '01910000-0000-7000-8000-000000000088' as Op['outletId'];
    const r = await applyBatch(repo, [op], ctx);
    expect(r.results[0]!.status).toBe('rejected');
  });

  it('rejects op older than maxAgeMinutes', async () => {
    const repo = makeRepo();
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString();
    const op = makeOp('01910000-0000-7000-8000-00000000000e', 'order.create', oldDate);
    const r = await applyBatch(repo, [op], ctx, { maxAgeMinutes: 14 * 24 * 60 });
    expect(r.results[0]!.status).toBe('rejected');
    if (r.results[0]!.status === 'rejected') {
      expect(r.results[0]!.code).toBe('OP_TOO_OLD');
    }
  });

  it('captures apply failure as rejection', async () => {
    const repo = makeRepo({
      applyImpl: async () => {
        throw Object.assign(new Error('something failed'), { code: 'CUSTOM_FAIL' });
      },
    });
    const op = makeOp('01910000-0000-7000-8000-00000000000f');
    const r = await applyBatch(repo, [op], ctx);
    expect(r.results[0]!.status).toBe('rejected');
    if (r.results[0]!.status === 'rejected') {
      expect(r.results[0]!.code).toBe('CUSTOM_FAIL');
    }
  });

  it('applies many ops in order', async () => {
    const repo = makeRepo();
    const ops = Array.from({ length: 10 }, (_, i) =>
      makeOp(`01910000-0000-7000-8000-00000000${i.toString().padStart(4, '0')}`),
    );
    const r = await applyBatch(repo, ops, ctx);
    expect(r.results).toHaveLength(10);
    expect(r.results.every((x) => x.status === 'applied')).toBe(true);
  });
});
