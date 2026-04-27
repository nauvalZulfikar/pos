/**
 * Anomaly detection worker. Runs daily, compares today's revenue vs rolling 7-day baseline.
 * Persists severities to anomalies table; severe anomalies enqueue WhatsApp alert.
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, gte, lte, sql, inArray } from '@desain/db';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type AnomalyJob = {
  tenantId: string;
  outletId: string | null;
  businessDay: string;
};

const SEVERITY_THRESHOLD_PCT = 20; // ±20%

export function startAnomalyWorker() {
  return new Worker<AnomalyJob>(
    QueueName.aiAnomalyDetection,
    async (job) => {
      const { tenantId, outletId, businessDay } = job.data;
      logger.debug({ tenantId, outletId, businessDay }, 'anomaly processing');

      // Today's revenue
      const todayRow = await db
        .select({
          revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenantId),
            eq(schema.orders.businessDay, businessDay),
            outletId ? eq(schema.orders.outletId, outletId) : undefined,
            inArray(schema.orders.status, ['paid', 'served']),
          ),
        );
      const todayRevenue = BigInt(todayRow[0]?.revenue ?? '0');

      // 7-day baseline (excluding today)
      const dayMs = 24 * 3600_000;
      const baselineFrom = new Date(Date.now() - 8 * dayMs).toISOString().slice(0, 10);
      const baselineTo = new Date(Date.now() - 1 * dayMs).toISOString().slice(0, 10);

      const baselineRows = await db
        .select({
          day: schema.orders.businessDay,
          revenue: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
        })
        .from(schema.orders)
        .where(
          and(
            eq(schema.orders.tenantId, tenantId),
            outletId ? eq(schema.orders.outletId, outletId) : undefined,
            gte(schema.orders.businessDay, baselineFrom),
            lte(schema.orders.businessDay, baselineTo),
            inArray(schema.orders.status, ['paid', 'served']),
          ),
        )
        .groupBy(schema.orders.businessDay);

      if (baselineRows.length < 3) {
        return { ok: true, skipped: 'insufficient_baseline' };
      }

      const baselineSum = baselineRows.reduce(
        (acc, r) => acc + BigInt(r.revenue),
        BigInt(0),
      );
      const baselineAvg = baselineSum / BigInt(baselineRows.length);

      if (baselineAvg === BigInt(0)) {
        return { ok: true, skipped: 'baseline_zero' };
      }

      const diff = todayRevenue - baselineAvg;
      const diffPct = Number((diff * BigInt(10000)) / baselineAvg) / 100;

      if (Math.abs(diffPct) < SEVERITY_THRESHOLD_PCT) {
        return { ok: true, normal: true };
      }

      const severity = Math.abs(diffPct) >= 50 ? 'high' : 'medium';

      await db.insert(schema.anomalies).values({
        id: uuidv7(),
        tenantId,
        outletId,
        metric: 'daily_revenue',
        severity,
        expectedValue: baselineAvg.toString(),
        observedValue: todayRevenue.toString(),
        detail: {
          businessDay,
          diffPct,
          baselineDays: baselineRows.length,
        },
      });

      logger.info(
        { tenantId, outletId, severity, diffPct },
        'anomaly: revenue deviation',
      );

      // TODO: enqueue WhatsApp template send if severity >= medium
      return { ok: true, severity, diffPct };
    },
    { connection, concurrency: 2 },
  );
}
