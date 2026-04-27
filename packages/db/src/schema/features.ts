import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Feature catalog. Read-mostly. Not tenant-scoped (it's a global menu of available features).
 */
export const features = pgTable(
  'features',
  {
    code: text('code').primaryKey(),
    group: text('group').notNull(),
    displayName: jsonb('display_name').notNull(),
    description: jsonb('description').notNull(),
    monthlyPrice: bigint('monthly_price', { mode: 'bigint' }).notNull(),
    dependsOn: jsonb('depends_on').notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    groupCheck: check(
      'features_group_chk',
      sql`${t.group} in ('core','payment','multi_outlet','delivery','inventory','ai','crm','compliance','ops')`,
    ),
  }),
);

export const tenantFeatures = pgTable(
  'tenant_features',
  {
    tenantId: uuid('tenant_id').notNull(),
    featureCode: text('feature_code').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    enabledAt: timestamp('enabled_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    source: text('source').notNull().default('subscription'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.featureCode] }),
    tenantIdx: index('tenant_features_tenant_idx').on(t.tenantId),
    sourceCheck: check(
      'tenant_features_source_chk',
      sql`source in ('subscription','trial','comp')`,
    ),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    status: text('status').notNull().default('active'),
    billingCycle: text('billing_cycle').notNull().default('monthly'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }).notNull(),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }).notNull(),
    /** Monthly bill snapshot at last computation. */
    lastBillSnapshot: jsonb('last_bill_snapshot'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    tenantIdx: index('subscriptions_tenant_idx').on(t.tenantId),
    statusCheck: check(
      'subscriptions_status_chk',
      sql`status in ('active','past_due','cancelled','trialing')`,
    ),
  }),
);

export type Feature = typeof features.$inferSelect;
export type TenantFeature = typeof tenantFeatures.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
