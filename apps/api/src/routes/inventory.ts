import { and, db, desc, eq, isNull, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const inventoryRouter = new Hono<{ Variables: RequestVars }>();

inventoryRouter.use('*', authRequired, tenantContext, requireFeatures(['inventory_recipe']));

inventoryRouter.get('/items', requirePermission('inventory:read'), async (c) => {
  const id = c.get('identity');
  const rows = await db.query.inventoryItems.findMany({
    where: and(
      eq(schema.inventoryItems.tenantId, id.tenantId),
      isNull(schema.inventoryItems.deletedAt),
    ),
    orderBy: [desc(schema.inventoryItems.updatedAt)],
    limit: 500,
  });
  return c.json({ items: rows });
});

const CreateInventoryItem = z.object({
  name: z.string().min(1).max(120),
  sku: z.string().max(40).nullable().optional(),
  unit: z.enum(['gram', 'kilogram', 'milliliter', 'liter', 'piece', 'pack']),
  unitCostRupiah: z.coerce.number().nonnegative(),
});

inventoryRouter.post('/items', requirePermission('inventory:adjust'), async (c) => {
  const id = c.get('identity');
  const input = CreateInventoryItem.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.inventoryItems).values({
    id: newId,
    tenantId: id.tenantId,
    name: input.name,
    sku: input.sku ?? null,
    unit: input.unit,
    unitCost: BigInt(Math.round(input.unitCostRupiah * 100)),
    isActive: true,
  });
  const created = await db.query.inventoryItems.findFirst({
    where: eq(schema.inventoryItems.id, newId),
  });
  return c.json({ item: created }, 201);
});

inventoryRouter.get('/levels', requirePermission('inventory:read'), async (c) => {
  const id = c.get('identity');
  const outletId = c.req.query('outletId');
  if (!outletId) throw new ProblemError(400, 'VALIDATION_FAILED', 'outletId required');
  const rows = await db.query.stockLevels.findMany({
    where: and(
      eq(schema.stockLevels.tenantId, id.tenantId),
      eq(schema.stockLevels.outletId, outletId),
    ),
  });
  return c.json({ items: rows });
});

const AdjustStock = z.object({
  outletId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  /** Positive number to add, negative to subtract; in base unit (not milli). */
  delta: z.coerce.number(),
  reason: z.string().min(1).max(200),
});

const TransferStock = z.object({
  fromOutletId: z.string().uuid(),
  toOutletId: z.string().uuid(),
  inventoryItemId: z.string().uuid(),
  /** Positive amount in base unit. */
  quantity: z.coerce.number().positive(),
  reason: z.string().min(1).max(200),
});

inventoryRouter.post('/transfer', requirePermission('inventory:adjust'), async (c) => {
  const id = c.get('identity');
  const input = TransferStock.parse(await c.req.json());
  if (input.fromOutletId === input.toOutletId) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Outlet asal & tujuan tidak boleh sama');
  }
  const qtyMilli = BigInt(Math.round(input.quantity * 1000));

  await db.transaction(async (tx) => {
    const fromLevel = await tx.query.stockLevels.findFirst({
      where: and(
        eq(schema.stockLevels.tenantId, id.tenantId),
        eq(schema.stockLevels.outletId, input.fromOutletId),
        eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
      ),
    });
    if (!fromLevel || fromLevel.quantityMilli < qtyMilli) {
      throw new ProblemError(409, 'CONFLICT', 'Stok di outlet asal tidak cukup');
    }

    // Out
    await tx.insert(schema.stockMovements).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      outletId: input.fromOutletId,
      inventoryItemId: input.inventoryItemId,
      type: 'transfer_out',
      deltaMilli: -qtyMilli,
      reason: input.reason,
      reference: input.toOutletId,
      performedBy: id.userId,
    });
    await tx
      .update(schema.stockLevels)
      .set({ quantityMilli: fromLevel.quantityMilli - qtyMilli, updatedAt: new Date() })
      .where(
        and(
          eq(schema.stockLevels.tenantId, id.tenantId),
          eq(schema.stockLevels.outletId, input.fromOutletId),
          eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
        ),
      );

    // In
    await tx.insert(schema.stockMovements).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      outletId: input.toOutletId,
      inventoryItemId: input.inventoryItemId,
      type: 'transfer_in',
      deltaMilli: qtyMilli,
      reason: input.reason,
      reference: input.fromOutletId,
      performedBy: id.userId,
    });
    const toLevel = await tx.query.stockLevels.findFirst({
      where: and(
        eq(schema.stockLevels.tenantId, id.tenantId),
        eq(schema.stockLevels.outletId, input.toOutletId),
        eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
      ),
    });
    if (toLevel) {
      await tx
        .update(schema.stockLevels)
        .set({ quantityMilli: toLevel.quantityMilli + qtyMilli, updatedAt: new Date() })
        .where(
          and(
            eq(schema.stockLevels.tenantId, id.tenantId),
            eq(schema.stockLevels.outletId, input.toOutletId),
            eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
          ),
        );
    } else {
      await tx.insert(schema.stockLevels).values({
        tenantId: id.tenantId,
        outletId: input.toOutletId,
        inventoryItemId: input.inventoryItemId,
        quantityMilli: qtyMilli,
        reorderThresholdMilli: null,
      });
    }
  });

  return c.json({ ok: true });
});

inventoryRouter.post('/adjust', requirePermission('inventory:adjust'), async (c) => {
  const id = c.get('identity');
  const input = AdjustStock.parse(await c.req.json());
  const deltaMilli = BigInt(Math.round(input.delta * 1000));

  await db.transaction(async (tx) => {
    await tx.insert(schema.stockMovements).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      outletId: input.outletId,
      inventoryItemId: input.inventoryItemId,
      type: 'manual_adjust',
      deltaMilli,
      reason: input.reason,
      reference: null,
      performedBy: id.userId,
    });
    // Upsert into stock_levels.
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
          quantityMilli: existing.quantityMilli + deltaMilli,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.stockLevels.tenantId, id.tenantId),
            eq(schema.stockLevels.outletId, input.outletId),
            eq(schema.stockLevels.inventoryItemId, input.inventoryItemId),
          ),
        );
    } else {
      await tx.insert(schema.stockLevels).values({
        tenantId: id.tenantId,
        outletId: input.outletId,
        inventoryItemId: input.inventoryItemId,
        quantityMilli: deltaMilli,
        reorderThresholdMilli: null,
      });
    }
  });

  return c.json({ ok: true });
});
