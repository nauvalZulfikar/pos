import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const vouchers = pgTable(
  'vouchers',
  {
    ...tenantOwnedColumns,
    code: text('code').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'percent' | 'amount' | 'happy_hour'
    /** For percent: 1-100. For amount: in sen. */
    value: bigint('value', { mode: 'bigint' }).notNull(),
    /** Min order subtotal in sen to be eligible. */
    minSubtotal: bigint('min_subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    /** Max usages per voucher (0 = unlimited). */
    maxUsages: integer('max_usages').notNull().default(0),
    usedCount: integer('used_count').notNull().default(0),
    validFrom: timestamp('valid_from', { withTimezone: true }),
    validTo: timestamp('valid_to', { withTimezone: true }),
    /** Happy hour window. JSON: { dayOfWeek: [], hourFrom: 'HH:mm', hourTo: 'HH:mm' } */
    schedule: text('schedule'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantCodeUq: uniqueIndex('vouchers_tenant_code_uq')
      .on(t.tenantId, t.code)
      .where(sql`deleted_at is null`),
    tenantIdx: index('vouchers_tenant_idx').on(t.tenantId),
    typeCheck: check('vouchers_type_chk', sql`type in ('percent','amount','happy_hour')`),
  }),
);

export const voucherRedemptions = pgTable(
  'voucher_redemptions',
  {
    ...tenantOwnedColumns,
    voucherId: tenantOwnedColumns.id, // reuse uuid column type
    orderId: tenantOwnedColumns.id,
    redeemedAt: timestamp('redeemed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    discountApplied: bigint('discount_applied', { mode: 'bigint' }).notNull(),
  },
  (t) => ({
    tenantIdx: index('voucher_redemptions_tenant_idx').on(t.tenantId),
  }),
);

export type Voucher = typeof vouchers.$inferSelect;
