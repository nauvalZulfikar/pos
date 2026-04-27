import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
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

export const orders = pgTable(
  'orders',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    shiftId: uuid('shift_id'),
    tableId: uuid('table_id'),
    outletOrderNumber: text('outlet_order_number').notNull(),
    /** Business day ISO date (Asia/Jakarta with boundary). For per-day numbering. */
    businessDay: text('business_day').notNull(),
    source: text('source').notNull(),
    pricingProfile: text('pricing_profile').notNull().default('dine_in'),
    status: text('status').notNull().default('open'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    guestCount: integer('guest_count'),
    subtotal: bigint('subtotal', { mode: 'bigint' }).notNull().default(sql`0`),
    discountTotal: bigint('discount_total', { mode: 'bigint' }).notNull().default(sql`0`),
    serviceCharge: bigint('service_charge', { mode: 'bigint' }).notNull().default(sql`0`),
    ppnTotal: bigint('ppn_total', { mode: 'bigint' }).notNull().default(sql`0`),
    rounding: bigint('rounding', { mode: 'bigint' }).notNull().default(sql`0`),
    total: bigint('total', { mode: 'bigint' }).notNull().default(sql`0`),
    discounts: jsonb('discounts').notNull().default(sql`'[]'::jsonb`),
    notes: text('notes'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    externalOrderId: text('external_order_id'),
    /** Stamped by sync endpoint when received. */
    receivedAt: timestamp('received_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdx: index('orders_tenant_idx').on(t.tenantId),
    outletDayIdx: index('orders_outlet_day_idx').on(t.tenantId, t.outletId, t.businessDay),
    statusIdx: index('orders_tenant_status_idx').on(t.tenantId, t.status),
    paidAtIdx: index('orders_paid_at_idx').on(t.tenantId, t.paidAt),
    extUq: uniqueIndex('orders_tenant_external_uq')
      .on(t.tenantId, t.source, t.externalOrderId)
      .where(sql`external_order_id is not null`),
    orderNumUq: uniqueIndex('orders_outlet_day_num_uq').on(
      t.tenantId,
      t.outletId,
      t.businessDay,
      t.outletOrderNumber,
    ),
    sourceCheck: check(
      'orders_source_chk',
      sql`source in ('pos_dine_in','pos_take_away','gofood','grabfood','shopeefood','whatsapp','web')`,
    ),
    statusCheck: check(
      'orders_status_chk',
      sql`status in ('open','sent_to_kitchen','ready','served','paid','voided','cancelled')`,
    ),
    totalsCheck: check(
      'orders_totals_chk',
      sql`subtotal >= 0 and discount_total >= 0 and service_charge >= 0 and ppn_total >= 0 and total >= 0`,
    ),
  }),
);

export const orderItems = pgTable(
  'order_items',
  {
    ...tenantOwnedColumns,
    orderId: uuid('order_id').notNull(),
    menuItemId: uuid('menu_item_id').notNull(),
    itemNameSnapshot: text('item_name_snapshot').notNull(),
    unitPrice: bigint('unit_price', { mode: 'bigint' }).notNull(),
    quantity: integer('quantity').notNull(),
    modifiers: jsonb('modifiers').notNull().default(sql`'[]'::jsonb`),
    modifiersTotal: bigint('modifiers_total', { mode: 'bigint' }).notNull().default(sql`0`),
    lineSubtotal: bigint('line_subtotal', { mode: 'bigint' }).notNull(),
    notes: text('notes'),
    status: text('status').notNull().default('queued'),
    ppnBpsSnapshot: integer('ppn_bps_snapshot').notNull().default(0),
    voidReason: text('void_reason'),
    voidedBy: uuid('voided_by'),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (t) => ({
    tenantOrderIdx: index('order_items_tenant_order_idx').on(t.tenantId, t.orderId),
    qtyCheck: check('order_items_qty_chk', sql`quantity > 0`),
    statusCheck: check(
      'order_items_status_chk',
      sql`status in ('queued','preparing','ready','served','voided')`,
    ),
  }),
);

export const tables = pgTable(
  'tables',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    label: text('label').notNull(),
    capacity: integer('capacity').notNull().default(2),
    status: text('status').notNull().default('available'),
  },
  (t) => ({
    outletIdx: index('tables_outlet_idx').on(t.tenantId, t.outletId),
    statusCheck: check(
      'tables_status_chk',
      sql`status in ('available','occupied','reserved','cleaning')`,
    ),
  }),
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Table = typeof tables.$inferSelect;
