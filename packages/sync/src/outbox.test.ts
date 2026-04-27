/**
 * @vitest-environment jsdom
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Op, SyncResponse } from '@desain/types';
import { uuidv7 } from 'uuidv7';
import {
  _resetTerminalDb,
  _setTerminalDb,
  drainAll,
  drainOnce,
  enqueueOp,
  pendingCount,
  pendingOps,
  type TerminalDB,
} from './client/index.js';

const ctx = {
  tenantId: '01910000-0000-7000-8000-000000000001',
  outletId: '01910000-0000-7000-8000-000000000002',
  shiftId: '01910000-0000-7000-8000-000000000003',
  userId: '01910000-0000-7000-8000-000000000004',
  deviceId: '01910000-0000-7000-8000-000000000005',
};

let db: TerminalDB;

beforeEach(async () => {
  db = _setTerminalDb(`test-${uuidv7()}`);
  await db.open();
});

afterEach(async () => {
  await db.delete();
  _resetTerminalDb();
});

function makeOpInput() {
  return {
    tenantId: ctx.tenantId as Op['tenantId'],
    outletId: ctx.outletId as Op['outletId'],
    shiftId: ctx.shiftId as Op['shiftId'],
    userId: ctx.userId as Op['userId'],
    deviceId: ctx.deviceId as Op['deviceId'],
    type: 'order.create' as Op['type'],
    payload: { foo: 1 },
  };
}

describe('outbox', () => {
  it('enqueueOp persists to opsPending with generated UUID', async () => {
    const op = await enqueueOp(makeOpInput(), db);
    expect(op.clientOpId).toBeTruthy();
    expect(await pendingCount(db)).toBe(1);
  });

  it('drainOnce sends pending ops via the provided fn and clears applied', async () => {
    await enqueueOp(makeOpInput(), db);
    await enqueueOp(makeOpInput(), db);

    const sentBatches: Op[][] = [];
    const send = async (batch: Op[]): Promise<SyncResponse> => {
      sentBatches.push(batch);
      return {
        results: batch.map((op) => ({
          clientOpId: op.clientOpId,
          status: 'applied' as const,
          receivedAt: new Date().toISOString(),
          canonical: [],
        })),
        serverNow: new Date().toISOString(),
      };
    };

    const r = await drainOnce(send, { db });
    expect(r.applied).toBe(2);
    expect(r.duplicates).toBe(0);
    expect(r.rejected).toHaveLength(0);
    expect(await pendingCount(db)).toBe(0);
    expect(await db.opsApplied.count()).toBe(2);
    expect(sentBatches).toHaveLength(1);
  });

  it('drainOnce records duplicates without re-applying', async () => {
    await enqueueOp(makeOpInput(), db);
    const send = async (batch: Op[]): Promise<SyncResponse> => ({
      results: batch.map((op) => ({
        clientOpId: op.clientOpId,
        status: 'duplicate' as const,
        receivedAt: new Date().toISOString(),
      })),
      serverNow: new Date().toISOString(),
    });
    const r = await drainOnce(send, { db });
    expect(r.duplicates).toBe(1);
    expect(await pendingCount(db)).toBe(0);
  });

  it('drainOnce records rejection in meta and removes from pending', async () => {
    await enqueueOp(makeOpInput(), db);
    const send = async (batch: Op[]): Promise<SyncResponse> => ({
      results: batch.map((op) => ({
        clientOpId: op.clientOpId,
        status: 'rejected' as const,
        code: 'TENANT_MISMATCH',
        detail: 'forced reject',
      })),
      serverNow: new Date().toISOString(),
    });
    const r = await drainOnce(send, { db });
    expect(r.rejected).toHaveLength(1);
    expect(r.rejected[0]!.code).toBe('TENANT_MISMATCH');
    expect(await pendingCount(db)).toBe(0);
    const meta = await db.meta.toArray();
    expect(meta.find((m) => m.key.startsWith('op_rejected:'))).toBeTruthy();
  });

  it('drainAll empties the outbox over multiple batches', async () => {
    for (let i = 0; i < 5; i++) await enqueueOp(makeOpInput(), db);
    const send = async (batch: Op[]): Promise<SyncResponse> => ({
      results: batch.map((op) => ({
        clientOpId: op.clientOpId,
        status: 'applied' as const,
        receivedAt: new Date().toISOString(),
        canonical: [],
      })),
      serverNow: new Date().toISOString(),
    });
    const r = await drainAll(send, { batchSize: 2, db });
    expect(r.applied).toBe(5);
    expect(await pendingCount(db)).toBe(0);
  });

  it('pendingOps respects ordering by clientAt', async () => {
    const earlier = await enqueueOp(
      { ...makeOpInput(), clientAt: '2026-05-01T00:00:00Z' },
      db,
    );
    const later = await enqueueOp(
      { ...makeOpInput(), clientAt: '2026-05-05T00:00:00Z' },
      db,
    );
    const ops = await pendingOps(10, db);
    expect(ops[0]!.clientOpId).toBe(earlier.clientOpId);
    expect(ops[1]!.clientOpId).toBe(later.clientOpId);
  });
});
