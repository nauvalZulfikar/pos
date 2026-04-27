import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const suppliers = pgTable(
  'suppliers',
  {
    ...tenantOwnedColumns,
    name: text('name').notNull(),
    contactName: text('contact_name'),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    npwp: text('npwp'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantIdx: index('suppliers_tenant_idx').on(t.tenantId),
  }),
);

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    ...tenantOwnedColumns,
    supplierId: uuid('supplier_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    poNumber: text('po_number').notNull(),
    status: text('status').notNull().default('draft'),
    /** [{inventoryItemId, quantityMilli, unitCost}] */
    items: jsonb('items').notNull().default(sql`'[]'::jsonb`),
    totalAmount: bigint('total_amount', { mode: 'bigint' }).notNull().default(sql`0`),
    expectedAt: timestamp('expected_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: uuid('created_by').notNull(),
  },
  (t) => ({
    tenantIdx: index('purchase_orders_tenant_idx').on(t.tenantId),
    statusCheck: check(
      'po_status_chk',
      sql`status in ('draft','sent','partial','received','cancelled')`,
    ),
  }),
);

export type Supplier = typeof suppliers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
