import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Server-side op log. Each successfully-applied op is recorded for audit + replay.
 */
export const syncOps = pgTable(
  'sync_ops',
  {
    clientOpId: uuid('client_op_id').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    shiftId: uuid('shift_id'),
    userId: uuid('user_id').notNull(),
    deviceId: uuid('device_id').notNull(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull(),
    clientAt: timestamp('client_at', { withTimezone: true }).notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    status: text('status').notNull().default('applied'),
  },
  (t) => ({
    tenantReceivedIdx: index('sync_ops_tenant_received_idx').on(t.tenantId, t.receivedAt),
    deviceIdx: index('sync_ops_device_idx').on(t.deviceId),
  }),
);

/** Idempotency key cache — for HTTP-level idempotency (Idempotency-Key header). */
export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    method: text('method').notNull(),
    path: text('path').notNull(),
    requestHash: text('request_hash').notNull(),
    responseStatus: text('response_status'),
    responseBody: jsonb('response_body'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiresIdx: index('idempotency_keys_expires_idx').on(t.expiresAt),
    tenantIdx: index('idempotency_keys_tenant_idx').on(t.tenantId),
  }),
);

export type SyncOp = typeof syncOps.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
