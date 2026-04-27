import { sql } from 'drizzle-orm';
import { boolean, check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().notNull(),
    legalName: text('legal_name').notNull(),
    displayName: text('display_name').notNull(),
    npwp: text('npwp'),
    isPkp: boolean('is_pkp').notNull().default(false),
    segment: text('segment').notNull(),
    defaultLocale: text('default_locale').notNull().default('id-ID'),
    defaultTimezone: text('default_timezone').notNull().default('Asia/Jakarta'),
    businessDayBoundary: text('business_day_boundary').notNull().default('04:00'),
    status: text('status').notNull().default('active'),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    segmentCheck: check(
      'tenants_segment_chk',
      sql`${t.segment} in ('warung','cafe','multi_cabang','chain')`,
    ),
    statusCheck: check(
      'tenants_status_chk',
      sql`${t.status} in ('active','suspended','churned')`,
    ),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type TenantInsert = typeof tenants.$inferInsert;
