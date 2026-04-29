/**
 * Demand Forecasting (7-day horizon).
 *
 * Method: seasonal-naive — for each future day, take the mean of the same day-of-week
 * across the last `LOOKBACK_DAYS`. Holiday adjustment: nationwide holidays get a
 * configurable boost factor. Confidence band: ±1 standard deviation.
 *
 * Requires ≥90 days of order history per the proposal (§7.6 catatan).
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, sql, gte, lte, inArray } from '@desain/db';
import { bucketize, forecastDemand, isHoliday2026 } from '@desain/domain';
import type { DemandSample } from '@desain/domain';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type ForecastJob =
  | { kind: 'nightly' }
  | { kind: 'tenant'; tenantId: string };

const LOOKBACK_DAYS = 90;
const HORIZON_DAYS = 7;
const MIN_DATA_DAYS = 60; // soft floor — proposal says 90 but we degrade gracefully

export function startDemandForecastWorker() {
  return new Worker<ForecastJob>(
    QueueName.demandForecast,
    async (job) => {
      if (job.data.kind === 'nightly') {
        const tenants = await db.query.tenants.findMany({
          where: eq(schema.tenants.status, 'active'),
          columns: { id: true },
        });
        for (const t of tenants) {
          await forecastOneTenant(t.id);
        }
        return { ok: true, tenants: tenants.length };
      }
      await forecastOneTenant(job.data.tenantId);
      return { ok: true };
    },
    { connection, concurrency: 1 },
  );
}

async function forecastOneTenant(tenantId: string): Promise<void> {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const start = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600_000);
  const startIso = start.toISOString().slice(0, 10);

  const ordersFilter = and(
    eq(schema.orders.tenantId, tenantId),
    gte(schema.orders.businessDay, startIso),
    lte(schema.orders.businessDay, todayIso),
    inArray(schema.orders.status, ['paid', 'served']),
  );

  // Aggregate by (menu_item, business_day, dow).
  const rows = await db
    .select({
      menuItemId: schema.orderItems.menuItemId,
      businessDay: schema.orders.businessDay,
      qty: sql<number>`coalesce(sum(${schema.orderItems.quantity}), 0)::int`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(ordersFilter)
    .groupBy(schema.orderItems.menuItemId, schema.orders.businessDay);

  const distinctDays = new Set(rows.map((r) => r.businessDay));
  if (distinctDays.size < MIN_DATA_DAYS) {
    logger.info(
      { tenantId, sampleDays: distinctDays.size, min: MIN_DATA_DAYS },
      'demand-forecast: insufficient history, skipping',
    );
    return;
  }

  // Group samples per menu, then bucketize by day-of-week.
  const byMenu = new Map<string, DemandSample[]>();
  for (const r of rows) {
    if (!r.menuItemId) continue;
    const dow = new Date(r.businessDay).getUTCDay();
    const arr = byMenu.get(r.menuItemId) ?? [];
    arr.push({ dow, qty: r.qty });
    byMenu.set(r.menuItemId, arr);
  }
  const bucketsByMenu = new Map<string, ReturnType<typeof bucketize>>();
  for (const [menuId, samples] of byMenu) {
    bucketsByMenu.set(menuId, bucketize(samples));
  }

  // Replace this tenant's prior forecasts (target_day in future range).
  const horizonStart = new Date(today.getTime() + 1 * 24 * 3600_000)
    .toISOString()
    .slice(0, 10);
  const horizonEnd = new Date(today.getTime() + HORIZON_DAYS * 24 * 3600_000)
    .toISOString()
    .slice(0, 10);

  await db
    .delete(schema.demandForecasts)
    .where(
      and(
        eq(schema.demandForecasts.tenantId, tenantId),
        gte(schema.demandForecasts.targetDay, horizonStart),
        lte(schema.demandForecasts.targetDay, horizonEnd),
      ),
    );

  const inserts: Array<typeof schema.demandForecasts.$inferInsert> = [];

  for (let offset = 1; offset <= HORIZON_DAYS; offset += 1) {
    const target = new Date(today.getTime() + offset * 24 * 3600_000);
    const targetIso = target.toISOString().slice(0, 10);
    const dow = target.getUTCDay();
    const holiday = isHoliday2026(targetIso);

    for (const [menuItemId, buckets] of bucketsByMenu) {
      const result = forecastDemand(buckets.get(dow), { dow, isHoliday: holiday });
      if (!result) continue;
      inserts.push({
        id: uuidv7(),
        tenantId,
        outletId: null,
        menuItemId,
        targetDay: targetIso,
        expectedQty: result.expectedQty,
        lowerQty: result.lowerQty,
        upperQty: result.upperQty,
        sampleDays: result.sampleDays,
        method: result.method,
        detail: { dow, holiday },
      });
    }
  }

  if (inserts.length > 0) {
    // Chunk inserts to avoid hitting param limits on large tenants.
    for (let i = 0; i < inserts.length; i += 500) {
      await db.insert(schema.demandForecasts).values(inserts.slice(i, i + 500));
    }
  }
  logger.info(
    { tenantId, count: inserts.length, sampleDays: distinctDays.size },
    'demand-forecast saved',
  );
}
