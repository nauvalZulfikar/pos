/**
 * Outbox — append local ops, drain to server in order.
 *
 * AGENTS.md §8.2–§8.4.
 */

import type { Op, OpResult, SyncResponse } from '@desain/types';
import { uuidv7 } from 'uuidv7';
import { appliedToCacheTable, getTerminalDb } from './db.js';
import type { TerminalDB } from './db.js';

export type EnqueueOpInput = Omit<Op, 'clientOpId' | 'clientAt'> & {
  clientOpId?: Op['clientOpId'];
  clientAt?: string;
};

export async function enqueueOp(
  input: EnqueueOpInput,
  db: TerminalDB = getTerminalDb(),
): Promise<Op> {
  const op: Op = {
    ...input,
    clientOpId: (input.clientOpId ?? uuidv7()) as Op['clientOpId'],
    clientAt: input.clientAt ?? new Date().toISOString(),
  };
  await db.opsPending.put(op);
  return op;
}

export async function pendingOps(
  limit: number,
  db: TerminalDB = getTerminalDb(),
): Promise<Op[]> {
  return db.opsPending.orderBy('clientAt').limit(limit).toArray();
}

export async function pendingCount(db: TerminalDB = getTerminalDb()): Promise<number> {
  return db.opsPending.count();
}

export type SendBatch = (batch: Op[]) => Promise<SyncResponse>;

export type DrainResult = {
  applied: number;
  duplicates: number;
  rejected: Array<{ clientOpId: string; code: string; detail: string }>;
};

const DEFAULT_BATCH_SIZE = 50;

export async function drainOnce(
  send: SendBatch,
  opts: { batchSize?: number; db?: TerminalDB } = {},
): Promise<DrainResult> {
  const db = opts.db ?? getTerminalDb();
  const ops = await pendingOps(opts.batchSize ?? DEFAULT_BATCH_SIZE, db);
  if (ops.length === 0) return { applied: 0, duplicates: 0, rejected: [] };

  const response = await send(ops);
  const result: DrainResult = { applied: 0, duplicates: 0, rejected: [] };

  await db.transaction(
    'rw',
    [db.opsPending, db.opsApplied, db.menuCategories, db.menuItems, db.modifierGroups,
      db.outlets, db.posTables, db.orders, db.orderItems, db.payments, db.shifts, db.cashMovements,
      db.customers, db.meta],
    async () => {
      for (const r of response.results) {
        const op = ops.find((o) => o.clientOpId === r.clientOpId);
        if (!op) continue;

        if (r.status === 'applied') {
          await db.opsPending.delete(r.clientOpId);
          await db.opsApplied.put({ ...op, status: 'applied', receivedAt: r.receivedAt });
          for (const c of r.canonical) {
            const cache = appliedToCacheTable(c.kind, db);
            if (!cache) continue;
            const row = c.row as { id?: string; tenant_id?: string; outlet_id?: string; updated_at?: string };
            if (!row.id) continue;
            await cache.put({
              id: row.id,
              tenantId: row.tenant_id ?? op.tenantId,
              outletId: row.outlet_id ?? op.outletId,
              data: row,
              updatedAt: row.updated_at ?? r.receivedAt,
            });
          }
          result.applied++;
        } else if (r.status === 'duplicate') {
          await db.opsPending.delete(r.clientOpId);
          await db.opsApplied.put({ ...op, status: 'duplicate', receivedAt: r.receivedAt });
          result.duplicates++;
        } else {
          // rejected: leave in pending so the user/operator can decide; record in meta for surfacing.
          result.rejected.push({ clientOpId: r.clientOpId, code: r.code, detail: r.detail });
          await db.meta.put({
            key: `op_rejected:${r.clientOpId}`,
            value: { code: r.code, detail: r.detail, at: response.serverNow },
          });
          // Move to opsApplied so the outbox doesn't get stuck. Operator surfaces from meta.
          await db.opsPending.delete(r.clientOpId);
        }
      }
    },
  );

  return result;
}

/**
 * Drain until empty or `maxBatches` reached. Returns aggregate result.
 * Use `runDrainLoop` for ongoing background drain.
 */
export async function drainAll(
  send: SendBatch,
  opts: { batchSize?: number; maxBatches?: number; db?: TerminalDB } = {},
): Promise<DrainResult> {
  const max = opts.maxBatches ?? 100;
  const aggregate: DrainResult = { applied: 0, duplicates: 0, rejected: [] };
  for (let i = 0; i < max; i++) {
    const r = await drainOnce(send, opts);
    aggregate.applied += r.applied;
    aggregate.duplicates += r.duplicates;
    aggregate.rejected.push(...r.rejected);
    if (r.applied + r.duplicates + r.rejected.length === 0) break;
  }
  return aggregate;
}

export async function gcAppliedOps(
  retentionDays = 7,
  db: TerminalDB = getTerminalDb(),
): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60_000).toISOString();
  return db.opsApplied.where('receivedAt').below(cutoff).delete();
}

/** Apply an op locally to the cache (optimistic update path). Returns the new row. */
export async function applyOpLocally(
  kind: string,
  row: { id: string; updatedAt?: string },
  ctx: { tenantId: string; outletId?: string },
  db: TerminalDB = getTerminalDb(),
): Promise<void> {
  const cache = appliedToCacheTable(kind, db);
  if (!cache) return;
  await cache.put({
    id: row.id,
    tenantId: ctx.tenantId,
    outletId: ctx.outletId,
    data: row,
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  });
}

export type { OpResult };
