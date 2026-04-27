import { z } from 'zod';
import { Money, OutletId, TenantOwnedBase, UserId, UuidV7 } from './common.js';
import { MenuItemId } from './menu.js';

export const InventoryItemId = UuidV7.brand<'InventoryItemId'>();
export type InventoryItemId = z.infer<typeof InventoryItemId>;

export const StockMovementId = UuidV7.brand<'StockMovementId'>();
export type StockMovementId = z.infer<typeof StockMovementId>;

export const InventoryUnit = z.enum(['gram', 'kilogram', 'milliliter', 'liter', 'piece', 'pack']);
export type InventoryUnit = z.infer<typeof InventoryUnit>;

export const InventoryItem = TenantOwnedBase.extend({
  id: InventoryItemId,
  name: z.string().min(1).max(120),
  sku: z.string().max(40).nullable(),
  unit: InventoryUnit,
  /** Cost per single base unit. */
  unitCost: Money,
  /** Stock alert threshold per outlet defined separately. */
  isActive: z.boolean(),
});
export type InventoryItem = z.infer<typeof InventoryItem>;

export const StockLevel = z.object({
  outletId: OutletId,
  inventoryItemId: InventoryItemId,
  /** Stored as integer of base unit × 1000 (precision: 0.001 unit). */
  quantityMilli: z.bigint(),
  reorderThresholdMilli: z.bigint().nullable(),
  updatedAt: z.string().datetime(),
});
export type StockLevel = z.infer<typeof StockLevel>;

export const StockMovementType = z.enum([
  'purchase',
  'sale_deduction',
  'manual_adjust',
  'transfer_in',
  'transfer_out',
  'waste',
  'correction',
]);
export type StockMovementType = z.infer<typeof StockMovementType>;

export const StockMovement = TenantOwnedBase.extend({
  id: StockMovementId,
  outletId: OutletId,
  inventoryItemId: InventoryItemId,
  type: StockMovementType,
  /** Signed delta in base unit × 1000. Negative = decrement. */
  deltaMilli: z.bigint(),
  reason: z.string().max(200).nullable(),
  reference: z.string().max(120).nullable(),
  performedBy: UserId,
  performedAt: z.string().datetime(),
});
export type StockMovement = z.infer<typeof StockMovement>;

export const RecipeIngredient = z.object({
  inventoryItemId: InventoryItemId,
  /** Quantity per 1 menu item, in base unit × 1000. */
  quantityMilli: z.bigint(),
});
export type RecipeIngredient = z.infer<typeof RecipeIngredient>;

export const Recipe = TenantOwnedBase.extend({
  menuItemId: MenuItemId,
  ingredients: z.array(RecipeIngredient),
  /** Auto-deduct on order paid? */
  autoDeduct: z.boolean(),
});
export type Recipe = z.infer<typeof Recipe>;

export const ManualAdjustmentInput = z.object({
  outletId: OutletId,
  inventoryItemId: InventoryItemId,
  deltaMilli: z.bigint(),
  reason: z.string().min(1).max(200),
});
export type ManualAdjustmentInput = z.infer<typeof ManualAdjustmentInput>;
