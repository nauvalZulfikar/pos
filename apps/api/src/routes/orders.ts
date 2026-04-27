import { eq, and, isNull, desc, db, schema } from '@desain/db';
import { computeLineSubtotal, computeOrderTotals, jakartaIsoDate } from '@desain/domain';
import { CreateOrderInput, ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { idempotency } from '../middleware/idempotency.js';
import type { RequestVars } from '../context.js';

export const orderRouter = new Hono<{ Variables: RequestVars }>();

orderRouter.use('*', authRequired, tenantContext);

orderRouter.get('/', async (c) => {
  const id = c.get('identity');
  const status = c.req.query('status');
  const outletId = c.req.query('outletId') ?? id.outletId;
  if (!outletId) throw new ProblemError(400, 'VALIDATION_FAILED', 'outletId required');

  const rows = await db.query.orders.findMany({
    where: and(
      eq(schema.orders.tenantId, id.tenantId),
      eq(schema.orders.outletId, outletId),
      status ? eq(schema.orders.status, status) : undefined,
      isNull(schema.orders.deletedAt),
    ),
    orderBy: [desc(schema.orders.updatedAt)],
    limit: 100,
  });
  return c.json({ items: rows });
});

orderRouter.get('/:id', async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  const items = await db.query.orderItems.findMany({
    where: and(
      eq(schema.orderItems.tenantId, id.tenantId),
      eq(schema.orderItems.orderId, orderId),
    ),
  });
  return c.json({ order: { ...order, items } });
});

orderRouter.post('/', requirePermission('order:create'), idempotency, async (c) => {
  const id = c.get('identity');
  const input = CreateOrderInput.parse(await c.req.json());

  const outlet = await db.query.outlets.findFirst({
    where: and(eq(schema.outlets.id, input.outletId), eq(schema.outlets.tenantId, id.tenantId)),
  });
  if (!outlet) throw new ProblemError(404, 'NOT_FOUND', 'Outlet not found');

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, id.tenantId),
  });
  if (!tenant) throw new ProblemError(404, 'NOT_FOUND', 'Tenant not found');

  // Resolve menu items + price snapshots
  const menuItemIds = [...new Set(input.items.map((i) => i.menuItemId))];
  const menu = menuItemIds.length === 0
    ? []
    : await db.query.menuItems.findMany({
        where: and(
          eq(schema.menuItems.tenantId, id.tenantId),
          isNull(schema.menuItems.deletedAt),
        ),
      });
  const menuById = new Map(menu.map((m) => [m.id, m]));

  const ppnBpsDefault = outlet.ppnBpsOverride ?? 1100; // 11%
  const orderId = uuidv7();
  const businessDay = jakartaIsoDate();
  const orderNumber = await nextOrderNumber(id.tenantId, input.outletId, businessDay);

  const itemRows: typeof schema.orderItems.$inferInsert[] = input.items.map((line) => {
    const m = menuById.get(line.menuItemId);
    if (!m) throw new ProblemError(400, 'VALIDATION_FAILED', `Unknown menu item ${line.menuItemId}`);
    const profilePrice =
      (m.pricingByProfile as Record<string, string | number | bigint>)[input.pricingProfile];
    const unitPrice =
      profilePrice !== undefined && profilePrice !== null ? BigInt(profilePrice as never) : m.basePrice;
    const lineSubtotal = computeLineSubtotal({
      unitPrice,
      modifiersTotal: BigInt(0),
      quantity: line.quantity,
    });
    return {
      id: uuidv7(),
      tenantId: id.tenantId,
      orderId,
      menuItemId: m.id,
      itemNameSnapshot: m.name,
      unitPrice,
      quantity: line.quantity,
      modifiers: [],
      modifiersTotal: BigInt(0),
      lineSubtotal,
      notes: line.notes ?? null,
      status: 'queued',
      ppnBpsSnapshot: m.ppnBpsOverride ?? ppnBpsDefault,
    };
  });

  const totals = computeOrderTotals({
    items: itemRows.map((i) => ({
      lineSubtotal: i.lineSubtotal as bigint,
      ppnBpsSnapshot: (i.ppnBpsSnapshot ?? ppnBpsDefault) as number,
      status: (i.status ?? 'queued') as string,
    })),
    orderDiscount: BigInt(0),
    serviceChargeBps: outlet.serviceChargeBps,
    tenantIsPkp: tenant.isPkp,
    roundingUnit: BigInt(0),
  });

  await db.transaction(async (tx) => {
    await tx.insert(schema.orders).values({
      id: orderId,
      tenantId: id.tenantId,
      outletId: input.outletId,
      shiftId: input.shiftId,
      tableId: input.tableId,
      outletOrderNumber: orderNumber,
      businessDay,
      source: input.source,
      pricingProfile: input.pricingProfile,
      status: 'open',
      customerName: input.customerName ?? null,
      customerPhone: input.customerPhone ?? null,
      guestCount: input.guestCount ?? null,
      ...totals,
      discounts: [],
      notes: input.notes ?? null,
      receivedAt: new Date(),
    });
    if (itemRows.length > 0) {
      await tx.insert(schema.orderItems).values(itemRows);
    }
  });

  const created = await db.query.orders.findFirst({ where: eq(schema.orders.id, orderId) });
  return c.json({ order: created, items: itemRows }, 201);
});

// ──────────────────────────────────────────────────── Void / Discount / Cancel ──

const VoidItemInput = z.object({
  reason: z.string().min(3).max(200),
});

orderRouter.post('/:id/items/:itemId/void', requirePermission('order:void'), async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const itemId = c.req.param('itemId');
  const input = VoidItemInput.parse(await c.req.json());

  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  if (order.status === 'paid' || order.status === 'voided' || order.status === 'cancelled') {
    throw new ProblemError(409, 'CONFLICT', `Order status ${order.status} tidak bisa diubah`);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.orderItems)
      .set({
        status: 'voided',
        voidReason: input.reason,
        voidedBy: id.userId,
        voidedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.orderItems.id, itemId),
          eq(schema.orderItems.tenantId, id.tenantId),
          eq(schema.orderItems.orderId, orderId),
        ),
      );

    // Recompute totals
    const items = await tx.query.orderItems.findMany({
      where: and(
        eq(schema.orderItems.tenantId, id.tenantId),
        eq(schema.orderItems.orderId, orderId),
      ),
    });
    const tenant = await tx.query.tenants.findFirst({
      where: eq(schema.tenants.id, id.tenantId),
    });
    const outlet = await tx.query.outlets.findFirst({
      where: eq(schema.outlets.id, order.outletId),
    });
    const totals = computeOrderTotals({
      items: items.map((i) => ({
        lineSubtotal: i.lineSubtotal,
        ppnBpsSnapshot: i.ppnBpsSnapshot,
        status: i.status,
      })),
      orderDiscount: order.discountTotal,
      serviceChargeBps: outlet?.serviceChargeBps ?? 0,
      tenantIsPkp: tenant?.isPkp ?? false,
    });
    await tx.update(schema.orders).set({ ...totals, updatedAt: new Date() }).where(
      eq(schema.orders.id, orderId),
    );
  });

  return c.json({ ok: true });
});

const ApplyDiscountInput = z.object({
  type: z.enum(['percent', 'amount']),
  value: z.coerce.number().nonnegative(),
  reason: z.string().min(3).max(200),
});

orderRouter.post('/:id/discount', requirePermission('order:apply_discount'), async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const input = ApplyDiscountInput.parse(await c.req.json());

  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== 'open' && order.status !== 'sent_to_kitchen' && order.status !== 'ready') {
    throw new ProblemError(409, 'CONFLICT', `Tidak bisa apply diskon di status ${order.status}`);
  }

  // Compute discount in sen
  let discountSen: bigint;
  if (input.type === 'percent') {
    if (input.value < 0 || input.value > 100) {
      throw new ProblemError(400, 'VALIDATION_FAILED', 'percent discount harus 0–100');
    }
    discountSen = (order.subtotal * BigInt(Math.round(input.value * 100))) / BigInt(10_000);
  } else {
    discountSen = BigInt(Math.round(input.value * 100));
  }
  if (discountSen > order.subtotal) discountSen = order.subtotal;

  type Disc = { type: string; value: string; reason: string; appliedBy: string; appliedAt: string };
  const newDiscount: Disc = {
    type: input.type,
    value: input.value.toString(),
    reason: input.reason,
    appliedBy: id.userId,
    appliedAt: new Date().toISOString(),
  };

  await db.transaction(async (tx) => {
    const items = await tx.query.orderItems.findMany({
      where: and(
        eq(schema.orderItems.tenantId, id.tenantId),
        eq(schema.orderItems.orderId, orderId),
      ),
    });
    const tenant = await tx.query.tenants.findFirst({
      where: eq(schema.tenants.id, id.tenantId),
    });
    const outlet = await tx.query.outlets.findFirst({
      where: eq(schema.outlets.id, order.outletId),
    });
    const totals = computeOrderTotals({
      items: items.map((i) => ({
        lineSubtotal: i.lineSubtotal,
        ppnBpsSnapshot: i.ppnBpsSnapshot,
        status: i.status,
      })),
      orderDiscount: discountSen,
      serviceChargeBps: outlet?.serviceChargeBps ?? 0,
      tenantIsPkp: tenant?.isPkp ?? false,
    });
    const existing = (order.discounts as Disc[] | null) ?? [];
    await tx
      .update(schema.orders)
      .set({
        ...totals,
        discounts: [...existing, newDiscount],
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));
  });

  return c.json({ ok: true, discountTotal: discountSen.toString() });
});

const CancelInput = z.object({ reason: z.string().min(3).max(200) });

orderRouter.post('/:id/cancel', requirePermission('order:void'), async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const input = CancelInput.parse(await c.req.json());

  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  if (order.status === 'paid') {
    throw new ProblemError(409, 'CONFLICT', 'Order yang sudah dibayar tidak bisa dibatalkan, gunakan refund.');
  }

  await db
    .update(schema.orders)
    .set({
      status: 'cancelled',
      notes: order.notes ? `${order.notes}\n[CANCEL] ${input.reason}` : `[CANCEL] ${input.reason}`,
      updatedAt: new Date(),
    })
    .where(eq(schema.orders.id, orderId));

  return c.json({ ok: true });
});

orderRouter.post('/:id/send-to-kitchen', requirePermission('order:create'), async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  await db
    .update(schema.orders)
    .set({ status: 'sent_to_kitchen', updatedAt: new Date() })
    .where(and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)));
  return c.json({ ok: true });
});

orderRouter.post('/:id/items/:itemId/status', requirePermission('order:edit'), async (c) => {
  const id = c.get('identity');
  const itemId = c.req.param('itemId');
  const orderId = c.req.param('id');
  const status = z.enum(['queued', 'preparing', 'ready', 'served', 'voided']).parse(
    (await c.req.json()).status,
  );
  await db
    .update(schema.orderItems)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(schema.orderItems.id, itemId),
        eq(schema.orderItems.orderId, orderId),
        eq(schema.orderItems.tenantId, id.tenantId),
      ),
    );
  return c.json({ ok: true });
});

async function nextOrderNumber(tenantId: string, outletId: string, businessDay: string): Promise<string> {
  const last = await db.query.orders.findFirst({
    where: and(
      eq(schema.orders.tenantId, tenantId),
      eq(schema.orders.outletId, outletId),
      eq(schema.orders.businessDay, businessDay),
    ),
    orderBy: [desc(schema.orders.outletOrderNumber)],
  });
  const next = last ? Number(last.outletOrderNumber) + 1 : 1;
  return next.toString().padStart(4, '0');
}
