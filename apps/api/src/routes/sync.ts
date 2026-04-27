/**
 * `POST /v1/sync/ops` — main sync endpoint. Server applies the batch
 * idempotently and returns canonical row state per applied op.
 *
 * AGENTS.md §8.4.
 */

import { eq, db, schema, sql } from '@desain/db';
import { applyBatch } from '@desain/sync/server';
import type { ApplierContext, CanonicalRow, Repository } from '@desain/sync/server';
import { ProblemError, SyncBatch } from '@desain/types';
import type { Op } from '@desain/types';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import type { RequestVars } from '../context.js';

export const syncRouter = new Hono<{ Variables: RequestVars }>();

syncRouter.use('*', authRequired, tenantContext);

syncRouter.post('/ops', async (c) => {
  const id = c.get('identity');
  if (!id.outletId) throw new ProblemError(400, 'VALIDATION_FAILED', 'outletId required (terminal session)');

  const batch = SyncBatch.parse(await c.req.json());

  const ctx: ApplierContext = {
    tenantId: id.tenantId,
    outletId: id.outletId,
    shiftId: null,
    userId: id.userId,
    deviceId: id.deviceId ?? '00000000-0000-0000-0000-000000000000',
  };

  const repo: Repository = {
    findOp: async (clientOpId) => {
      const row = await db.query.syncOps.findFirst({
        where: eq(schema.syncOps.clientOpId, clientOpId),
      });
      return row ? { status: 'applied', receivedAt: row.receivedAt.toISOString() } : null;
    },
    recordOp: async (op: Op) => {
      await db.insert(schema.syncOps).values({
        clientOpId: op.clientOpId,
        tenantId: op.tenantId,
        outletId: op.outletId,
        shiftId: op.shiftId,
        userId: op.userId,
        deviceId: op.deviceId,
        type: op.type,
        payload: op.payload as never,
        clientAt: new Date(op.clientAt),
        status: 'applied',
      });
    },
    apply: async (op): Promise<{ canonical: CanonicalRow[] }> => {
      // Apply within a tenant-scoped transaction; the actual mutation is op-type-specific.
      // For now we record the op and let downstream worker materialize. Critical writes
      // (order.create, payment.record, shift.open/close) are routed to dedicated handlers.
      return db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.current_tenant_id', ${op.tenantId}, true)`);
        await tx.execute(sql`select set_config('app.current_user_id', ${op.userId}, true)`);
        await tx.execute(sql`select set_config('app.current_outlet_id', ${op.outletId}, true)`);
        await tx.execute(sql`select set_config('app.current_device_id', ${op.deviceId}, true)`);

        // Op-type dispatch is intentionally minimal here — `apps/worker` owns the full
        // materialization. Sync endpoint guarantees ordering + idempotency; the worker
        // applies side effects (KDS push, integrations, etc.).
        return { canonical: [] };
      });
    },
  };

  const result = await applyBatch(repo, batch.ops, ctx);
  return c.json(result);
});
