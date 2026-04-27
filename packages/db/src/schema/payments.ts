import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const payments = pgTable(
  'payments',
  {
    ...tenantOwnedColumns,
    orderId: uuid('order_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    method: text('method').notNull(),
    provider: text('provider').notNull().default('manual'),
    providerRef: text('provider_ref'),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    changeReturned: bigint('change_returned', { mode: 'bigint' }).notNull().default(sql`0`),
    qrPayload: text('qr_payload'),
    providerFee: bigint('provider_fee', { mode: 'bigint' }),
    status: text('status').notNull().default('pending'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    recordedBy: uuid('recorded_by').notNull(),
    notes: text('notes'),
  },
  (t) => ({
    tenantOrderIdx: index('payments_tenant_order_idx').on(t.tenantId, t.orderId),
    statusIdx: index('payments_tenant_status_idx').on(t.tenantId, t.status),
    methodCheck: check(
      'payments_method_chk',
      sql`method in ('cash','qris','gopay','ovo','dana','shopeepay','card_edc','bank_transfer','voucher','other')`,
    ),
    statusCheck: check(
      'payments_status_chk',
      sql`status in ('pending','awaiting_settlement','settled','failed','refunded','partially_refunded','cancelled')`,
    ),
    providerCheck: check(
      'payments_provider_chk',
      sql`provider in ('midtrans','xendit','manual')`,
    ),
    amountCheck: check('payments_amount_chk', sql`amount >= 0`),
  }),
);

export const paymentRefunds = pgTable(
  'payment_refunds',
  {
    ...tenantOwnedColumns,
    paymentId: uuid('payment_id').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    reason: text('reason').notNull(),
    providerRef: text('provider_ref'),
    status: text('status').notNull().default('pending'),
    refundedBy: uuid('refunded_by').notNull(),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
  },
  (t) => ({
    paymentIdx: index('payment_refunds_payment_idx').on(t.tenantId, t.paymentId),
    statusCheck: check(
      'payment_refunds_status_chk',
      sql`status in ('pending','succeeded','failed')`,
    ),
  }),
);

export type Payment = typeof payments.$inferSelect;
export type PaymentRefund = typeof paymentRefunds.$inferSelect;
