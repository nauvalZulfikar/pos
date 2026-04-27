import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const customers = pgTable(
  'customers',
  {
    ...tenantOwnedColumns,
    fullName: text('full_name').notNull(),
    /** Hashed for indexing; plaintext only for outbound WhatsApp. */
    phoneHash: text('phone_hash'),
    phoneEncrypted: text('phone_encrypted'),
    email: text('email'),
    npwp: text('npwp_encrypted'),
    /** Custom tags / segments. */
    tags: jsonb('tags').notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    lastVisitAt: timestamp('last_visit_at', { withTimezone: true }),
    visitCount: integer('visit_count').notNull().default(0),
  },
  (t) => ({
    tenantIdx: index('customers_tenant_idx').on(t.tenantId),
    phoneHashUq: uniqueIndex('customers_tenant_phone_hash_uq')
      .on(t.tenantId, t.phoneHash)
      .where(sql`phone_hash is not null and deleted_at is null`),
  }),
);

export const loyaltyAccounts = pgTable(
  'loyalty_accounts',
  {
    ...tenantOwnedColumns,
    customerId: tenantOwnedColumns.id, // reuses uuid column type — actual FK is customer_id
    pointsBalance: bigint('points_balance', { mode: 'bigint' }).notNull().default(sql`0`),
    tier: text('tier').notNull().default('regular'),
  },
  (t) => ({
    tenantIdx: index('loyalty_accounts_tenant_idx').on(t.tenantId),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
