/**
 * Daily Brief generator. Aggregates → LLM → save.
 * Falls back to deterministic template if Anthropic key missing.
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, sql, desc, inArray } from '@desain/db';
import { llm as llmInt } from '@desain/integrations';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type DailyBriefJob = {
  tenantId: string;
  outletId: string | null;
  businessDay: string;
};

type Facts = {
  outletName: string;
  businessDay: string;
  totals: {
    grossSales: number;
    orderCount: number;
    avgOrderValue: number;
    voidCount: number;
    discountTotal: number;
  };
  comparisons: { grossSalesVs7d: number; orderCountVs7d: number; avgOrderValueVs7d: number };
  topItems: { name: string; quantity: number; revenue: number }[];
  worstItems: { name: string; quantity: number; revenue: number }[];
  anomalies: { metric: string; severity: string; observed: string; expected: string }[];
  ppnIfPkp: { collected: number } | null;
};

const FALLBACK_VERSION = 'fallback-2026-04-25';

export function startDailyBriefWorker() {
  return new Worker<DailyBriefJob>(
    QueueName.aiDailyBrief,
    async (job) => {
      const { tenantId, outletId, businessDay } = job.data;
      logger.debug({ tenantId, outletId, businessDay }, 'daily-brief processing');

      const ordersFilter = and(
        eq(schema.orders.tenantId, tenantId),
        eq(schema.orders.businessDay, businessDay),
        outletId ? eq(schema.orders.outletId, outletId) : undefined,
        inArray(schema.orders.status, ['paid', 'served']),
      );

      const totals = await db
        .select({
          orderCount: sql<number>`count(*)::int`,
          grossSales: sql<string>`coalesce(sum(${schema.orders.total}), 0)::text`,
          discountTotal: sql<string>`coalesce(sum(${schema.orders.discountTotal}), 0)::text`,
          ppnTotal: sql<string>`coalesce(sum(${schema.orders.ppnTotal}), 0)::text`,
        })
        .from(schema.orders)
        .where(ordersFilter);
      const t = totals[0]!;

      const topItems = await db
        .select({
          name: schema.orderItems.itemNameSnapshot,
          quantity: sql<number>`sum(${schema.orderItems.quantity})::int`,
          revenue: sql<string>`coalesce(sum(${schema.orderItems.lineSubtotal}), 0)::text`,
        })
        .from(schema.orderItems)
        .innerJoin(schema.orders, eq(schema.orders.id, schema.orderItems.orderId))
        .where(ordersFilter)
        .groupBy(schema.orderItems.itemNameSnapshot)
        .orderBy(desc(sql`sum(${schema.orderItems.lineSubtotal})`))
        .limit(5);

      const tenant = await db.query.tenants.findFirst({
        where: eq(schema.tenants.id, tenantId),
      });
      const outletName = outletId
        ? (await db.query.outlets.findFirst({ where: eq(schema.outlets.id, outletId) }))?.name ??
          'Outlet'
        : tenant?.displayName ?? 'Tenant';

      const grossSalesNum = Number(BigInt(t.grossSales) / BigInt(100));
      const orderCount = t.orderCount;
      const avgOrderValue = orderCount > 0 ? Math.round(grossSalesNum / orderCount) : 0;

      const facts: Facts = {
        outletName,
        businessDay,
        totals: {
          grossSales: grossSalesNum,
          orderCount,
          avgOrderValue,
          voidCount: 0,
          discountTotal: Number(BigInt(t.discountTotal) / BigInt(100)),
        },
        comparisons: { grossSalesVs7d: 0, orderCountVs7d: 0, avgOrderValueVs7d: 0 },
        topItems: topItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          revenue: Number(BigInt(i.revenue) / BigInt(100)),
        })),
        worstItems: [],
        anomalies: [],
        ppnIfPkp: tenant?.isPkp
          ? { collected: Number(BigInt(t.ppnTotal) / BigInt(100)) }
          : null,
      };

      let narrative: string;
      let recommendation: { title: string; detail: string; expectedImpact: string };
      let promptVersion = FALLBACK_VERSION;
      let modelId = 'fallback';
      let tokensInput = 0;
      let tokensOutput = 0;

      if (process.env.ANTHROPIC_API_KEY) {
        try {
          const client = new llmInt.LlmClient({
            apiKey: process.env.ANTHROPIC_API_KEY,
            dailyBriefModel:
              process.env.ANTHROPIC_DAILY_BRIEF_MODEL ?? 'claude-haiku-4-5-20251001',
          });
          const r = await client.generateDailyBrief(facts);
          narrative = `${r.output.greeting}\n\n${r.output.highlights.map((h) => `• ${h}`).join('\n')}`;
          recommendation = r.output.recommendation;
          promptVersion = r.meta.promptVersion;
          modelId = r.meta.modelId;
          tokensInput = r.meta.tokensInput;
          tokensOutput = r.meta.tokensOutput;
        } catch (err) {
          logger.warn({ err }, 'daily-brief: LLM failed, falling back');
          ({ narrative, recommendation } = fallbackBrief(facts));
        }
      } else {
        ({ narrative, recommendation } = fallbackBrief(facts));
      }

      await db
        .insert(schema.dailyBriefs)
        .values({
          id: uuidv7(),
          tenantId,
          outletId,
          businessDay,
          facts,
          narrative,
          recommendation,
          promptVersion,
          modelId,
          tokensInput,
          tokensOutput,
        })
        .onConflictDoNothing();

      logger.info({ tenantId, outletId, businessDay, modelId }, 'daily-brief saved');
      return { ok: true, modelId };
    },
    { connection, concurrency: 2 },
  );
}

function fallbackBrief(facts: Facts) {
  const greeting = `Selamat pagi! Berikut ringkasan ${facts.outletName} pada ${facts.businessDay}.`;
  const highlights: string[] = [];
  highlights.push(
    `${facts.totals.orderCount} order, total Rp ${facts.totals.grossSales.toLocaleString('id-ID')}.`,
  );
  if (facts.totals.avgOrderValue > 0) {
    highlights.push(
      `Rata-rata per order Rp ${facts.totals.avgOrderValue.toLocaleString('id-ID')}.`,
    );
  }
  if (facts.topItems.length > 0) {
    highlights.push(`Menu terlaris: ${facts.topItems[0]?.name ?? '—'}.`);
  }

  return {
    narrative: `${greeting}\n\n${highlights.map((h) => `• ${h}`).join('\n')}`,
    recommendation: {
      title: facts.totals.orderCount === 0 ? 'Promosi minggu ini' : 'Stok bahan terlaris',
      detail:
        facts.totals.orderCount === 0
          ? 'Belum ada transaksi hari ini. Pertimbangkan welcome promo untuk hari pertama.'
          : `Pastikan stok ${facts.topItems[0]?.name ?? 'menu terlaris'} cukup untuk besok.`,
      expectedImpact: 'Mengurangi resiko kehabisan menu favorit',
    },
  };
}
