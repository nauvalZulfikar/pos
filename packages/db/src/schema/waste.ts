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

/**
 * Daily food waste log. AGENTS.md §28.4 (Phase 4 inventory).
 * Each row is one waste event reported by a kitchen staff.
 */
export const wasteEvents = pgTable(
  'waste_events',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    inventoryItemId: uuid('inventory_item_id').notNull(),
    /** Base unit × 1000, always positive. */
    quantityMilli: bigint('quantity_milli', { mode: 'bigint' }).notNull(),
    reason: text('reason').notNull(),
    reportedBy: uuid('reported_by').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    outletDayIdx: index('waste_events_outlet_day_idx').on(t.tenantId, t.outletId, t.reportedAt),
    qtyCheck: check('waste_events_qty_chk', sql`quantity_milli > 0`),
  }),
);

export type WasteEvent = typeof wasteEvents.$inferSelect;
