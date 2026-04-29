import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const dailyBriefs = pgTable(
  'daily_briefs',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id'),
    /** Business day this brief covers. ISO date. */
    businessDay: text('business_day').notNull(),
    facts: jsonb('facts').notNull(),
    narrative: text('narrative').notNull(),
    recommendation: jsonb('recommendation').notNull(),
    promptVersion: text('prompt_version').notNull(),
    modelId: text('model_id').notNull(),
    tokensInput: integer('tokens_input').notNull().default(0),
    tokensOutput: integer('tokens_output').notNull().default(0),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => ({
    tenantDayUq: uniqueIndex('daily_briefs_tenant_outlet_day_uq').on(
      t.tenantId,
      t.outletId,
      t.businessDay,
    ),
    tenantDayIdx: index('daily_briefs_tenant_day_idx').on(t.tenantId, t.businessDay),
  }),
);

export const menuPerformanceScores = pgTable(
  'menu_performance_scores',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id'),
    menuItemId: uuid('menu_item_id').notNull(),
    periodStart: text('period_start').notNull(),
    periodEnd: text('period_end').notNull(),
    /** "sapi_perah" | "bintang" | "tanda_tanya" | "anjing" — BCG category. */
    category: text('category').notNull(),
    salesQuantity: integer('sales_quantity').notNull(),
    grossRevenue: bigint('gross_revenue', { mode: 'bigint' }).notNull(),
    grossMargin: bigint('gross_margin', { mode: 'bigint' }).notNull(),
    rationale: text('rationale'),
  },
  (t) => ({
    itemPeriodIdx: index('menu_perf_item_period_idx').on(
      t.tenantId,
      t.menuItemId,
      t.periodStart,
    ),
  }),
);

export const anomalies = pgTable(
  'anomalies',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id'),
    detectedAt: timestamp('detected_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    metric: text('metric').notNull(),
    severity: text('severity').notNull(),
    expectedValue: text('expected_value'),
    observedValue: text('observed_value'),
    detail: jsonb('detail').notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedBy: uuid('acknowledged_by'),
  },
  (t) => ({
    tenantDetectedIdx: index('anomalies_tenant_detected_idx').on(t.tenantId, t.detectedAt),
  }),
);

/**
 * Demand forecast for a single (menu_item, future_day) pair. Refreshed nightly.
 * Forecast uses seasonal-naive (same day-of-week mean) + Indonesian holiday boost.
 */
export const demandForecasts = pgTable(
  'demand_forecasts',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id'),
    menuItemId: uuid('menu_item_id').notNull(),
    /** ISO date the forecast targets. */
    targetDay: text('target_day').notNull(),
    /** Forecasted units. */
    expectedQty: integer('expected_qty').notNull(),
    /** Lower 80% confidence bound. */
    lowerQty: integer('lower_qty').notNull(),
    /** Upper 80% confidence bound. */
    upperQty: integer('upper_qty').notNull(),
    /** Days of historical data used for this forecast. */
    sampleDays: integer('sample_days').notNull(),
    method: text('method').notNull(),
    detail: jsonb('detail'),
  },
  (t) => ({
    targetIdx: index('demand_forecasts_target_idx').on(
      t.tenantId,
      t.targetDay,
      t.menuItemId,
    ),
    uniqIdx: uniqueIndex('demand_forecasts_uq').on(
      t.tenantId,
      t.outletId,
      t.menuItemId,
      t.targetDay,
    ),
  }),
);

export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type MenuPerformanceScore = typeof menuPerformanceScores.$inferSelect;
export type Anomaly = typeof anomalies.$inferSelect;
export type DemandForecast = typeof demandForecasts.$inferSelect;
