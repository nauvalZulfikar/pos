/**
 * Menu Performance Scoring (BCG matrix). Runs weekly.
 *
 * Classifies each menu item as one of:
 *   bintang (star)      — high volume + high margin
 *   sapi_perah (cash cow) — high volume + low margin
 *   tanda_tanya (?)     — low volume + high margin
 *   anjing (dog)        — low volume + low margin
 *
 * Cutoff is the median across the tenant (top half = "high"). Period: trailing 30 days.
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, sql, gte, lte, inArray } from '@desain/db';
import { classifyMenuPerformance, median, medianBig, rationaleFor } from '@desain/domain';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type MenuScoreJob =
  | { kind: 'weekly' }
  | { kind: 'tenant'; tenantId: string };

const PERIOD_DAYS = 30;

export function startMenuScoreWorker() {
  return new Worker<MenuScoreJob>(
    QueueName.aiMenuScore,
    async (job) => {
      if (job.data.kind === 'weekly') {
        const tenants = await db.query.tenants.findMany({
          where: eq(schema.tenants.status, 'active'),
          columns: { id: true },
        });
        for (const t of tenants) {
          await scoreOneTenant(t.id);
        }
        return { ok: true, tenantCount: tenants.length };
      }
      await scoreOneTenant(job.data.tenantId);
      return { ok: true };
    },
    { connection, concurrency: 1 },
  );
}

async function scoreOneTenant(tenantId: string): Promise<void> {
  const today = new Date();
  const periodEnd = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - PERIOD_DAYS * 24 * 3600_000);
  const periodStart = start.toISOString().slice(0, 10);

  const ordersFilter = and(
    eq(schema.orders.tenantId, tenantId),
    gte(schema.orders.businessDay, periodStart),
    lte(schema.orders.businessDay, periodEnd),
    inArray(schema.orders.status, ['paid', 'served']),
  );

  const rows = await db
    .select({
      menuItemId: schema.orderItems.menuItemId,
      itemName: schema.orderItems.itemNameSnapshot,
      qty: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
      revenue: sql<string>`coalesce(sum(${schema.orderItems.lineSubtotal}), 0)::text`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(ordersFilter)
    .groupBy(schema.orderItems.menuItemId, schema.orderItems.itemNameSnapshot);

  if (rows.length === 0) {
    logger.debug({ tenantId }, 'menu-score: no data, skipping');
    return;
  }

  // Pre-compute recipe cost per menu item (foodCostBps = recipeCost / sellPrice).
  const recipes = await db.query.recipes.findMany({
    where: eq(schema.recipes.tenantId, tenantId),
  });
  const inventory = await db.query.inventoryItems.findMany({
    where: eq(schema.inventoryItems.tenantId, tenantId),
  });
  const invById = new Map(inventory.map((i) => [i.id, i]));

  const recipeCostByMenu = new Map<string, bigint>();
  for (const r of recipes) {
    const ings = r.ingredients as Array<{ inventoryItemId: string; quantityMilli: string }>;
    let cost = BigInt(0);
    for (const ing of ings) {
      const inv = invById.get(ing.inventoryItemId);
      if (!inv) continue;
      cost += (inv.unitCost * BigInt(ing.quantityMilli)) / BigInt(1000);
    }
    recipeCostByMenu.set(r.menuItemId, cost);
  }

  type Row = {
    menuItemId: string | null;
    itemName: string;
    qty: number;
    revenue: bigint;
    cost: bigint;
    margin: bigint;
  };
  const enriched: Row[] = rows
    .filter((r): r is typeof r & { menuItemId: string } => r.menuItemId != null)
    .map((r) => {
      const revenue = BigInt(r.revenue);
      const cost = (recipeCostByMenu.get(r.menuItemId) ?? BigInt(0)) * BigInt(r.qty);
      return {
        menuItemId: r.menuItemId,
        itemName: r.itemName,
        qty: r.qty,
        revenue,
        cost,
        margin: revenue - cost,
      };
    });

  // Compute medians (high/low cutoffs).
  const qtyMedian = median(enriched.map((r) => r.qty));
  const marginMedian = medianBig(enriched.map((r) => r.margin));

  // Insert per-menu rows. Replace prior period.
  await db
    .delete(schema.menuPerformanceScores)
    .where(
      and(
        eq(schema.menuPerformanceScores.tenantId, tenantId),
        eq(schema.menuPerformanceScores.periodStart, periodStart),
        eq(schema.menuPerformanceScores.periodEnd, periodEnd),
      ),
    );

  for (const r of enriched) {
    if (!r.menuItemId) continue;
    const category = classifyMenuPerformance({
      qty: r.qty,
      margin: r.margin,
      qtyCutoff: qtyMedian,
      marginCutoff: marginMedian,
    });
    const rationale = rationaleFor(category, r.itemName);
    await db.insert(schema.menuPerformanceScores).values({
      id: uuidv7(),
      tenantId,
      outletId: null,
      menuItemId: r.menuItemId,
      periodStart,
      periodEnd,
      category,
      salesQuantity: r.qty,
      grossRevenue: r.revenue,
      grossMargin: r.margin,
      rationale,
    });
  }
  logger.info({ tenantId, count: enriched.length, periodStart, periodEnd }, 'menu-score saved');
}
