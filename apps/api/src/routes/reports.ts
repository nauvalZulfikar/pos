/**
 * Reports v1 — daily summary, top items.
 * Read-only; no idempotency / mutations.
 */

import { and, count, db, desc, eq, gte, inArray, lte, schema, sql } from '@desain/db';
import { jakartaIsoDate } from '@desain/domain';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const reportsRouter = new Hono<{ Variables: RequestVars }>();

reportsRouter.use('*', authRequired, tenantContext, requirePermission('reports:view'));

const DailyQuery = z.object({
  outletId: z.string().uuid().optional(),
  /** ISO date in Jakarta tz (defaults to today). */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

reportsRouter.get('/daily', async (c) => {
  const id = c.get('identity');
  const q = DailyQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const day = q.day ?? jakartaIsoDate();
  const outletId = q.outletId ?? id.outletId;

  const where = and(
    eq(schema.orders.tenantId, id.tenantId),
    eq(schema.orders.businessDay, day),
    outletId ? eq(schema.orders.outletId, outletId) : undefined,
    inArray(schema.orders.status, ['paid', 'served']),
  );

  const totalsRow = await db
    .select({
      orderCount: count(),
      grossSales: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
      discountTotal: sql<string>`coalesce(sum(${schema.orders.discountTotal}), 0)::text`,
      ppnTotal: sql<string>`coalesce(sum(${schema.orders.ppnTotal}), 0)::text`,
      serviceCharge: sql<string>`coalesce(sum(${schema.orders.serviceCharge}), 0)::text`,
    })
    .from(schema.orders)
    .where(where)
    .limit(1);
  const totals = totalsRow[0] ?? {
    orderCount: 0,
    grossSales: '0',
    discountTotal: '0',
    ppnTotal: '0',
    serviceCharge: '0',
  };

  const voidsRow = await db
    .select({ voidCount: count() })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        eq(schema.orders.businessDay, day),
        outletId ? eq(schema.orders.outletId, outletId) : undefined,
        eq(schema.orders.status, 'voided'),
      ),
    );

  return c.json({
    day,
    outletId: outletId ?? null,
    orderCount: totals.orderCount,
    voidCount: voidsRow[0]?.voidCount ?? 0,
    grossSales: totals.grossSales,
    discountTotal: totals.discountTotal,
    ppnTotal: totals.ppnTotal,
    serviceCharge: totals.serviceCharge,
    avgOrderValue:
      totals.orderCount > 0
        ? (BigInt(totals.grossSales) / BigInt(totals.orderCount)).toString()
        : '0',
  });
});

const RangeQuery = z.object({
  outletId: z.string().uuid().optional(),
  /** ISO date inclusive. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

reportsRouter.get('/sales-trend', async (c) => {
  const id = c.get('identity');
  const q = RangeQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (q.from > q.to) throw new ProblemError(400, 'VALIDATION_FAILED', 'from must be <= to');

  const outletId = q.outletId ?? id.outletId;

  const rows = await db
    .select({
      day: schema.orders.businessDay,
      orderCount: count(),
      grossSales: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        gte(schema.orders.businessDay, q.from),
        lte(schema.orders.businessDay, q.to),
        outletId ? eq(schema.orders.outletId, outletId) : undefined,
        inArray(schema.orders.status, ['paid', 'served']),
      ),
    )
    .groupBy(schema.orders.businessDay)
    .orderBy(schema.orders.businessDay);

  return c.json({
    from: q.from,
    to: q.to,
    outletId: outletId ?? null,
    series: rows,
  });
});

reportsRouter.get('/peak-hours', async (c) => {
  const id = c.get('identity');
  const q = RangeQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const outletId = q.outletId ?? id.outletId;

  // Bucket orders by hour-of-day in Asia/Jakarta tz. Returns 24 hourly slots.
  const rows = await db
    .select({
      hour: sql<number>`extract(hour from (${schema.orders.createdAt} at time zone 'Asia/Jakarta'))::int`,
      orderCount: count(),
      revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        gte(schema.orders.businessDay, q.from),
        lte(schema.orders.businessDay, q.to),
        outletId ? eq(schema.orders.outletId, outletId) : undefined,
        inArray(schema.orders.status, ['paid', 'served']),
      ),
    )
    .groupBy(sql`extract(hour from (${schema.orders.createdAt} at time zone 'Asia/Jakarta'))`)
    .orderBy(sql`extract(hour from (${schema.orders.createdAt} at time zone 'Asia/Jakarta'))`);

  // Fill 24 hours
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  const series = Array.from({ length: 24 }, (_, h) => {
    const r = byHour.get(h);
    return {
      hour: h,
      orderCount: r?.orderCount ?? 0,
      revenue: r?.revenue ?? '0',
    };
  });

  // Recommend top 3 peak hours by revenue
  const topPeak = [...series]
    .sort((a, b) => Number(BigInt(b.revenue) - BigInt(a.revenue)))
    .slice(0, 3)
    .map((r) => r.hour);

  return c.json({
    from: q.from,
    to: q.to,
    outletId: outletId ?? null,
    series,
    peakHours: topPeak,
  });
});

reportsRouter.get('/top-items', async (c) => {
  const id = c.get('identity');
  const q = RangeQuery.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const limit = Number(new URL(c.req.url).searchParams.get('limit') ?? '10');

  const rows = await db
    .select({
      menuItemId: schema.orderItems.menuItemId,
      itemName: schema.orderItems.itemNameSnapshot,
      quantity: sql<number>`sum(${schema.orderItems.quantity})::int`,
      revenue: sql<string>`coalesce(sum(${schema.orderItems.lineSubtotal}), 0)::text`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        gte(schema.orders.businessDay, q.from),
        lte(schema.orders.businessDay, q.to),
        q.outletId ? eq(schema.orders.outletId, q.outletId) : undefined,
        inArray(schema.orders.status, ['paid', 'served']),
        eq(schema.orderItems.status, 'served'),
      ),
    )
    .groupBy(schema.orderItems.menuItemId, schema.orderItems.itemNameSnapshot)
    .orderBy(desc(sql`sum(${schema.orderItems.lineSubtotal})`))
    .limit(Math.min(50, Math.max(1, isFinite(limit) ? limit : 10)));

  return c.json({ items: rows });
});
