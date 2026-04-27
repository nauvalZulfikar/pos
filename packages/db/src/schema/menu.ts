import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenantOwnedColumns } from './columns';

export const menuCategories = pgTable(
  'menu_categories',
  {
    ...tenantOwnedColumns,
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    iconKey: text('icon_key'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantIdx: index('menu_categories_tenant_idx').on(t.tenantId),
  }),
);

export const menuItems = pgTable(
  'menu_items',
  {
    ...tenantOwnedColumns,
    categoryId: uuid('category_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    sku: text('sku'),
    basePrice: bigint('base_price', { mode: 'bigint' }).notNull(),
    /** { dine_in: 12000, delivery: 13000, ... } */
    pricingByProfile: jsonb('pricing_by_profile').notNull().default(sql`'{}'::jsonb`),
    outletOverrides: jsonb('outlet_overrides').notNull().default(sql`'[]'::jsonb`),
    imageUrl: text('image_url'),
    modifierGroupIds: jsonb('modifier_group_ids').notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
    ppnBpsOverride: integer('ppn_bps_override'),
  },
  (t) => ({
    tenantIdx: index('menu_items_tenant_idx').on(t.tenantId),
    categoryIdx: index('menu_items_category_idx').on(t.tenantId, t.categoryId),
    skuUq: uniqueIndex('menu_items_tenant_sku_uq')
      .on(t.tenantId, t.sku)
      .where(sql`sku is not null and deleted_at is null`),
    basePriceCheck: check('menu_items_base_price_chk', sql`${t.basePrice} >= 0`),
  }),
);

export const modifierGroups = pgTable(
  'modifier_groups',
  {
    ...tenantOwnedColumns,
    name: text('name').notNull(),
    selectionMin: integer('selection_min').notNull().default(0),
    selectionMax: integer('selection_max').notNull().default(1),
    required: boolean('required').notNull().default(false),
    /** Array of { id, name, priceDelta, isDefault, sortOrder } */
    modifiers: jsonb('modifiers').notNull().default(sql`'[]'::jsonb`),
  },
  (t) => ({
    tenantIdx: index('modifier_groups_tenant_idx').on(t.tenantId),
  }),
);

export type MenuCategory = typeof menuCategories.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type ModifierGroup = typeof modifierGroups.$inferSelect;
