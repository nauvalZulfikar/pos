import { sql } from 'drizzle-orm';
import {
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

export const platformCommissionRates = pgTable(
  'platform_commission_rates',
  {
    tenantId: uuid('tenant_id').notNull(),
    platform: text('platform').notNull(),
    commissionBps: integer('commission_bps').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
  },
  (t) => ({
    tenantPlatformIdx: index('platform_commission_tenant_idx').on(t.tenantId, t.platform),
  }),
);

export const deliveryPlatformLinks = pgTable(
  'delivery_platform_links',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    platform: text('platform').notNull(),
    /** Platform-side merchant id. */
    externalMerchantId: text('external_merchant_id').notNull(),
    /** Encrypted credential bundle. */
    credentialsEncrypted: text('credentials_encrypted'),
    autoAccept: jsonb('auto_accept').notNull().default(sql`'{"enabled":false}'::jsonb`),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    syncStatus: text('sync_status').notNull().default('idle'),
    syncError: text('sync_error'),
  },
  (t) => ({
    outletIdx: index('delivery_platform_outlet_idx').on(t.tenantId, t.outletId, t.platform),
    extUq: uniqueIndex('delivery_platform_ext_uq').on(t.platform, t.externalMerchantId),
  }),
);

export const deliveryWebhookEvents = pgTable(
  'delivery_webhook_events',
  {
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    platform: text('platform').notNull(),
    /** Provider-side event id, used for replay protection. */
    externalEventId: text('external_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    status: text('status').notNull().default('queued'),
    error: text('error'),
  },
  (t) => ({
    extUq: uniqueIndex('delivery_webhook_ext_uq').on(t.platform, t.externalEventId),
    tenantStatusIdx: index('delivery_webhook_status_idx').on(t.tenantId, t.status),
  }),
);

export type PlatformCommissionRate = typeof platformCommissionRates.$inferSelect;
export type DeliveryPlatformLink = typeof deliveryPlatformLinks.$inferSelect;
export type DeliveryWebhookEvent = typeof deliveryWebhookEvents.$inferSelect;
