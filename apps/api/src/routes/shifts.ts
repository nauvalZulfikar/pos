import { and, db, eq, schema, sql } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const shiftRouter = new Hono<{ Variables: RequestVars }>();

shiftRouter.use(
  '*',
  authRequired,
  tenantContext,
  requireFeatures(['shift_cash_drawer']),
);

const OpenShiftInput = z.object({
  outletId: z.string().uuid(),
  startingCash: z.coerce.bigint(),
});

shiftRouter.post('/open', requirePermission('shift:open'), async (c) => {
  const id = c.get('identity');
  const input = OpenShiftInput.parse(await c.req.json());

  // Reject if there's already an open shift on this outlet
  const existing = await db.query.shifts.findFirst({
    where: and(
      eq(schema.shifts.tenantId, id.tenantId),
      eq(schema.shifts.outletId, input.outletId),
      eq(schema.shifts.status, 'open'),
    ),
  });
  if (existing) {
    throw new ProblemError(409, 'CONFLICT', 'Shift sudah terbuka untuk cabang ini.');
  }

  const newId = uuidv7();
  await db.insert(schema.shifts).values({
    id: newId,
    tenantId: id.tenantId,
    outletId: input.outletId,
    openedBy: id.userId,
    startingCash: input.startingCash,
    status: 'open',
  });
  const created = await db.query.shifts.findFirst({ where: eq(schema.shifts.id, newId) });
  return c.json({ shift: created }, 201);
});

shiftRouter.get('/active', async (c) => {
  const id = c.get('identity');
  const outletId = c.req.query('outletId') ?? id.outletId;
  if (!outletId) throw new ProblemError(400, 'VALIDATION_FAILED', 'outletId required');
  const shift = await db.query.shifts.findFirst({
    where: and(
      eq(schema.shifts.tenantId, id.tenantId),
      eq(schema.shifts.outletId, outletId),
      eq(schema.shifts.status, 'open'),
    ),
  });
  return c.json({ shift: shift ?? null });
});

const CloseShiftInput = z.object({
  countedCash: z.coerce.bigint(),
  notes: z.string().max(1000).nullable().optional(),
});

shiftRouter.post('/:id/close', requirePermission('shift:close'), async (c) => {
  const id = c.get('identity');
  const shiftId = c.req.param('id');
  const input = CloseShiftInput.parse(await c.req.json());

  const shift = await db.query.shifts.findFirst({
    where: and(eq(schema.shifts.id, shiftId), eq(schema.shifts.tenantId, id.tenantId)),
  });
  if (!shift) throw new ProblemError(404, 'NOT_FOUND', 'Shift not found');
  if (shift.status !== 'open') {
    throw new ProblemError(409, 'CONFLICT', `Shift status ${shift.status} tidak bisa ditutup`);
  }

  // Compute expected cash from settled cash payments during this shift
  const cashSumRow = await db
    .select({
      total: sql<string>`coalesce(sum(${schema.payments.amount}), 0)::text`,
    })
    .from(schema.payments)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.payments.orderId))
    .where(
      and(
        eq(schema.payments.tenantId, id.tenantId),
        eq(schema.orders.shiftId, shiftId),
        eq(schema.payments.method, 'cash'),
        eq(schema.payments.status, 'settled'),
      ),
    );
  const cashIn = BigInt(cashSumRow[0]?.total ?? '0');
  const expected = shift.startingCash + cashIn;
  const variance = input.countedCash - expected;

  // Sum order count + sales
  const salesRow = await db
    .select({
      orders: sql<number>`count(*)::int`,
      total: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        eq(schema.orders.shiftId, shiftId),
        eq(schema.orders.status, 'paid'),
      ),
    );

  await db
    .update(schema.shifts)
    .set({
      status: 'closed',
      closedBy: id.userId,
      closedAt: new Date(),
      expectedCash: expected,
      countedCash: input.countedCash,
      cashVariance: variance,
      totalSales: BigInt(salesRow[0]?.total ?? '0'),
      totalOrders: salesRow[0]?.orders ?? 0,
      closingNotes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.shifts.id, shiftId));

  const closed = await db.query.shifts.findFirst({ where: eq(schema.shifts.id, shiftId) });
  return c.json({
    shift: closed,
    summary: {
      startingCash: shift.startingCash.toString(),
      cashIn: cashIn.toString(),
      expected: expected.toString(),
      counted: input.countedCash.toString(),
      variance: variance.toString(),
      totalSales: salesRow[0]?.total ?? '0',
      totalOrders: salesRow[0]?.orders ?? 0,
    },
  });
});

shiftRouter.get('/:id/summary', async (c) => {
  const id = c.get('identity');
  const shiftId = c.req.param('id');
  const shift = await db.query.shifts.findFirst({
    where: and(eq(schema.shifts.id, shiftId), eq(schema.shifts.tenantId, id.tenantId)),
  });
  if (!shift) throw new ProblemError(404, 'NOT_FOUND', 'Shift not found');
  return c.json({ shift });
});
