import { and, db, desc, eq, gte, lte, schema, sql } from '@desain/db';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const wasteRouter = new Hono<{ Variables: RequestVars }>();

wasteRouter.use('*', authRequired, tenantContext, requireFeatures(['inventory_recipe']));

const ReportWasteInput = z.object({
  outletId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  quantity: z.coerce.number().positive(), // base unit
  reason: z.string().min(1).max(200),
});

wasteRouter.post('/', requirePermission('inventory:adjust'), async (c) => {
  const id = c.get('identity');
  const input = ReportWasteInput.parse(await c.req.json());
  const qtyMilli = BigInt(Math.round(input.quantity * 1000));

  await db.transaction(async (tx) => {
    await tx.insert(schema.wasteEvents).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      outletId: input.outletId,
      inventoryItemId: input.inventoryItemId,
      quantityMilli: qtyMilli,
      reason: input.reason,
      reportedBy: id.userId,
    });

    // Decrement stock_levels
    const existing = await tx.query.stockLevels.findFirst({
      where: and(
        eq(schema.stockLevels.tenantId, id.tenantId),
        eq(schema.stockLevels.outletId, input.outletId),
        eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
      ),
    });
    if (existing) {
      await tx
        .update(schema.stockLevels)
        .set({
          quantityMilli: existing.quantityMilli - qtyMilli,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.stockLevels.tenantId, id.tenantId),
            eq(schema.stockLevels.outletId, input.outletId),
            eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
          ),
        );
    }

    // Log as stock_movement type 'waste'
    await tx.insert(schema.stockMovements).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      outletId: input.outletId,
      inventoryItemId: input.inventoryItemId,
      type: 'waste',
      deltaMilli: -qtyMilli,
      reason: input.reason,
      performedBy: id.userId,
    });
  });

  return c.json({ ok: true });
});

wasteRouter.get('/', requirePermission('inventory:read'), async (c) => {
  const id = c.get('identity');
  const outletId = c.req.query('outletId');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const rows = await db.query.wasteEvents.findMany({
    where: and(
      eq(schema.wasteEvents.tenantId, id.tenantId),
      outletId ? eq(schema.wasteEvents.outletId, outletId) : undefined,
      from ? gte(schema.wasteEvents.reportedAt, new Date(from)) : undefined,
      to ? lte(schema.wasteEvents.reportedAt, new Date(to)) : undefined,
    ),
    orderBy: [desc(schema.wasteEvents.reportedAt)],
    limit: 200,
  });
  return c.json({ items: rows });
});

wasteRouter.get('/summary', requirePermission('reports:view'), async (c) => {
  const id = c.get('identity');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const rows = await db
    .select({
      inventoryItemId: schema.wasteEvents.inventoryItemId,
      totalMilli: sql<string>`coalesce(sum(${schema.wasteEvents.quantityMilli}), 0)::text`,
      events: sql<number>`count(*)::int`,
    })
    .from(schema.wasteEvents)
    .where(
      and(
        eq(schema.wasteEvents.tenantId, id.tenantId),
        from ? gte(schema.wasteEvents.reportedAt, new Date(from)) : undefined,
        to ? lte(schema.wasteEvents.reportedAt, new Date(to)) : undefined,
      ),
    )
    .groupBy(schema.wasteEvents.inventoryItemId);
  return c.json({ items: rows });
});
