import { and, db, eq, schema, sql, gte, lte, inArray } from '@desain/db';
import { computeMargin } from '@desain/domain';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireAnyFeatures } from '../middleware/entitlement.js';
import { enqueueDeliverySync } from '../queues.js';
import type { RequestVars } from '../context.js';

export const deliveryRouter = new Hono<{ Variables: RequestVars }>();

deliveryRouter.use('*', authRequired, tenantContext);

const DELIVERY_FEATURES = [
  'gofood_integration',
  'grabfood_integration',
  'shopeefood_integration',
] as const;

deliveryRouter.use(
  '*',
  requireAnyFeatures(DELIVERY_FEATURES),
);

deliveryRouter.get('/links', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.deliveryPlatformLinks.findMany({
    where: eq(schema.deliveryPlatformLinks.tenantId, id.tenantId),
  });
  return c.json({ items: rows });
});

const LinkInput = z.object({
  outletId: z.string().uuid(),
  platform: z.enum(['gofood', 'grabfood', 'shopeefood']),
  externalMerchantId: z.string().min(1),
  autoAccept: z.object({
    enabled: z.boolean().default(false),
    maxWaitSeconds: z.number().int().nonnegative().default(0),
  }).optional(),
});

deliveryRouter.post('/links', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = LinkInput.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.deliveryPlatformLinks).values({
    id: newId,
    tenantId: id.tenantId,
    outletId: input.outletId,
    platform: input.platform,
    externalMerchantId: input.externalMerchantId,
    autoAccept: input.autoAccept ?? { enabled: false },
    syncStatus: 'idle',
  });
  return c.json({ id: newId }, 201);
});

deliveryRouter.post('/sync-menu', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  await db
    .update(schema.deliveryPlatformLinks)
    .set({ syncStatus: 'queued', updatedAt: new Date() })
    .where(eq(schema.deliveryPlatformLinks.tenantId, id.tenantId));
  await enqueueDeliverySync(id.tenantId);
  return c.json({ ok: true, message: 'Menu sync queued for all linked platforms' });
});

deliveryRouter.get('/analytics', requirePermission('reports:view'), async (c) => {
  const id = c.get('identity');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const platforms = ['gofood', 'grabfood', 'shopeefood'] as const;
  const rows = await db
    .select({
      source: schema.orders.source,
      orders: sql<number>`count(*)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        from ? gte(schema.orders.businessDay, from) : undefined,
        to ? lte(schema.orders.businessDay, to) : undefined,
        inArray(schema.orders.source, [...platforms]),
        inArray(schema.orders.status, ['paid', 'served']),
      ),
    )
    .groupBy(schema.orders.source);
  return c.json({ items: rows });
});

const MarginQuery = z.object({
  outletId: z.string().uuid().optional(),
  platform: z.enum(['gofood', 'grabfood', 'shopeefood']),
});

deliveryRouter.get('/margin', requirePermission('reports:view'), async (c) => {
  const id = c.get('identity');
  const params = MarginQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));

  const commission = await db.query.platformCommissionRates.findFirst({
    where: and(
      eq(schema.platformCommissionRates.tenantId, id.tenantId),
      eq(schema.platformCommissionRates.platform, params.platform),
    ),
  });
  const commissionBps = commission?.commissionBps ?? 2000; // default 20%

  const items = await db.query.menuItems.findMany({
    where: eq(schema.menuItems.tenantId, id.tenantId),
    limit: 200,
  });

  const recipes = await db.query.recipes.findMany({
    where: eq(schema.recipes.tenantId, id.tenantId),
  });
  const recipeByMenu = new Map(recipes.map((r) => [r.menuItemId, r]));

  // Pre-fetch inventory costs for unique ids
  const inventory = await db.query.inventoryItems.findMany({
    where: eq(schema.inventoryItems.tenantId, id.tenantId),
  });
  const invById = new Map(inventory.map((i) => [i.id, i]));

  const margins = items.map((item) => {
    const recipe = recipeByMenu.get(item.id);
    let recipeCost = BigInt(0);
    if (recipe) {
      const ings = recipe.ingredients as Array<{ inventoryItemId: string; quantityMilli: string }>;
      for (const ing of ings) {
        const inv = invById.get(ing.inventoryItemId);
        if (!inv) continue;
        recipeCost += (inv.unitCost * BigInt(ing.quantityMilli)) / BigInt(1000);
      }
    }
    const m = computeMargin({
      menuPrice: item.basePrice,
      recipeCost,
      commissionBps,
    });
    return {
      menuItemId: item.id,
      name: item.name,
      menuPrice: m.menuPrice.toString(),
      recipeCost: m.recipeCost.toString(),
      commissionAmount: m.commissionAmount.toString(),
      netReceived: m.netReceived.toString(),
      marginAmount: m.marginAmount.toString(),
      marginBps: m.marginBps,
    };
  });

  return c.json({
    platform: params.platform,
    commissionBps,
    items: margins,
  });
});
