import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseColumns, tenantOwnedColumns } from './columns';

export const inventoryItems = pgTable(
  'inventory_items',
  {
    ...tenantOwnedColumns,
    name: text('name').notNull(),
    sku: text('sku'),
    unit: text('unit').notNull(),
    unitCost: bigint('unit_cost', { mode: 'bigint' }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantIdx: index('inventory_items_tenant_idx').on(t.tenantId),
    skuUq: uniqueIndex('inventory_items_tenant_sku_uq')
      .on(t.tenantId, t.sku)
      .where(sql`sku is not null and deleted_at is null`),
    unitCheck: check(
      'inventory_items_unit_chk',
      sql`unit in ('gram','kilogram','milliliter','liter','piece','pack')`,
    ),
  }),
);

export const stockLevels = pgTable(
  'stock_levels',
  {
    tenantId: uuid('tenant_id').notNull(),
    outletId: uuid('outlet_id').notNull(),
    inventoryItemId: uuid('inventory_item_id').notNull(),
    /** Base unit × 1000. */
    quantityMilli: bigint('quantity_milli', { mode: 'bigint' }).notNull().default(sql`0`),
    reorderThresholdMilli: bigint('reorder_threshold_milli', { mode: 'bigint' }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.tenantId, t.outletId, t.inventoryItemId] }),
  }),
);

export const stockMovements = pgTable(
  'stock_movements',
  {
    ...tenantOwnedColumns,
    outletId: uuid('outlet_id').notNull(),
    inventoryItemId: uuid('inventory_item_id').notNull(),
    type: text('type').notNull(),
    deltaMilli: bigint('delta_milli', { mode: 'bigint' }).notNull(),
    reason: text('reason'),
    reference: text('reference'),
    performedBy: uuid('performed_by').notNull(),
    performedAt: timestamp('performed_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    outletItemIdx: index('stock_movements_outlet_item_idx').on(
      t.tenantId,
      t.outletId,
      t.inventoryItemId,
    ),
    typeCheck: check(
      'stock_movements_type_chk',
      sql`type in ('purchase','sale_deduction','manual_adjust','transfer_in','transfer_out','waste','correction')`,
    ),
  }),
);

export const recipes = pgTable(
  'recipes',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    menuItemId: uuid('menu_item_id').notNull(),
    ingredients: jsonb('ingredients').notNull().default(sql`'[]'::jsonb`),
    autoDeduct: boolean('auto_deduct').notNull().default(true),
  },
  (t) => ({
    menuUq: uniqueIndex('recipes_menu_item_uq').on(t.tenantId, t.menuItemId),
  }),
);

export type InventoryItem = typeof inventoryItems.$inferSelect;
export type StockLevel = typeof stockLevels.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
