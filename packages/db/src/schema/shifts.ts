import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const shifts = pgTable(
  'shifts',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    openedBy: uuid('opened_by').notNull(),
    closedBy: uuid('closed_by'),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    startingCash: bigint('starting_cash', { mode: 'bigint' }).notNull(),
    expectedCash: bigint('expected_cash', { mode: 'bigint' }),
    countedCash: bigint('counted_cash', { mode: 'bigint' }),
    cashVariance: bigint('cash_variance', { mode: 'bigint' }),
    totalSales: bigint('total_sales', { mode: 'bigint' }).notNull().default(sql`0`),
    totalOrders: integer('total_orders').notNull().default(0),
    status: text('status').notNull().default('open'),
    closingNotes: text('closing_notes'),
  },
  (t) => ({
    tenantOutletIdx: index('shifts_tenant_outlet_idx').on(t.tenantId, t.outletId),
    statusIdx: index('shifts_tenant_status_idx').on(t.tenantId, t.status),
    statusCheck: check('shifts_status_chk', sql`status in ('open','closing','closed')`),
  }),
);

export const cashMovements = pgTable(
  'cash_movements',
  {
    ...tenantOwnedColumns,
    shiftId: uuid('shift_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    type: text('type').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    reason: text('reason'),
    performedBy: uuid('performed_by').notNull(),
    performedAt: timestamp('performed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    shiftIdx: index('cash_movements_shift_idx').on(t.tenantId, t.shiftId),
    typeCheck: check(
      'cash_movements_type_chk',
      sql`type in ('drop','pickup','expense','correction','tip')`,
    ),
  }),
);

export type Shift = typeof shifts.$inferSelect;
export type CashMovement = typeof cashMovements.$inferSelect;
