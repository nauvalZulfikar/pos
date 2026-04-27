import { z } from 'zod';
import { Money, OutletId, TenantOwnedBase, UuidV7 } from './common.js';

export const MenuCategoryId = UuidV7.brand<'MenuCategoryId'>();
export type MenuCategoryId = z.infer<typeof MenuCategoryId>;

export const MenuItemId = UuidV7.brand<'MenuItemId'>();
export type MenuItemId = z.infer<typeof MenuItemId>;

export const ModifierGroupId = UuidV7.brand<'ModifierGroupId'>();
export type ModifierGroupId = z.infer<typeof ModifierGroupId>;

export const ModifierId = UuidV7.brand<'ModifierId'>();
export type ModifierId = z.infer<typeof ModifierId>;

export const PricingProfile = z.enum(['dine_in', 'take_away', 'delivery', 'happy_hour']);
export type PricingProfile = z.infer<typeof PricingProfile>;

export const MenuCategory = TenantOwnedBase.extend({
  id: MenuCategoryId,
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().nonnegative(),
  iconKey: z.string().max(40).nullable(),
  isActive: z.boolean(),
});
export type MenuCategory = z.infer<typeof MenuCategory>;

export const MenuItem = TenantOwnedBase.extend({
  id: MenuItemId,
  categoryId: MenuCategoryId,
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullable(),
  /** SKU for inventory linkage. */
  sku: z.string().max(40).nullable(),
  basePrice: Money,
  pricingByProfile: z.record(PricingProfile, Money).default({}),
  /** Per-outlet availability + price override. */
  outletOverrides: z.array(
    z.object({
      outletId: OutletId,
      isAvailable: z.boolean(),
      priceOverride: Money.nullable(),
    }),
  ),
  imageUrl: z.string().url().nullable(),
  modifierGroupIds: z.array(ModifierGroupId),
  isActive: z.boolean(),
  /** Optional per-item PPN treatment. null = use tenant default. */
  ppnBpsOverride: z.number().int().min(0).max(2500).nullable(),
});
export type MenuItem = z.infer<typeof MenuItem>;

export const Modifier = z.object({
  id: ModifierId,
  name: z.string().min(1).max(80),
  priceDelta: z.bigint(),
  isDefault: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
});
export type Modifier = z.infer<typeof Modifier>;

export const ModifierGroup = TenantOwnedBase.extend({
  id: ModifierGroupId,
  name: z.string().min(1).max(80),
  selectionMin: z.number().int().min(0),
  selectionMax: z.number().int().min(1),
  required: z.boolean(),
  modifiers: z.array(Modifier),
});
export type ModifierGroup = z.infer<typeof ModifierGroup>;

export const CreateMenuItemInput = MenuItem.pick({
  categoryId: true,
  name: true,
  description: true,
  sku: true,
  basePrice: true,
  pricingByProfile: true,
  imageUrl: true,
  modifierGroupIds: true,
  ppnBpsOverride: true,
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemInput>;
