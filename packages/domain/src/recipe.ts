/**
 * Recipe costing.
 *
 * Each recipe lists ingredients with quantity-per-1-menu-item in base unit × 1000.
 * Cost = sum(ingredient.unitCost × quantity / 1000).
 *
 * AGENTS.md §13.4 (margin-after-commission depends on this).
 */

import { ZERO, divRoundHalfEven, sum } from './money.js';
import type { Sen } from './money.js';

/** Plain shape — avoids the Zod brand so internal callers can pass either. */
export type RecipeIngredientInput = {
  inventoryItemId: string;
  quantityMilli: bigint;
};

export type RecipeInput = {
  ingredients: readonly RecipeIngredientInput[];
};

export type InventoryCostLookup = ReadonlyMap<string, { unitCost: bigint }>;

export type RecipeCostInput = {
  recipe: RecipeInput;
  inventoryById: InventoryCostLookup;
};

export type RecipeCostBreakdown = {
  totalCost: Sen;
  byIngredient: { inventoryItemId: string; cost: Sen }[];
  unknownIngredients: string[];
};

export function computeRecipeCost(input: RecipeCostInput): RecipeCostBreakdown {
  const breakdown: RecipeCostBreakdown['byIngredient'] = [];
  const unknown: string[] = [];

  for (const ing of input.recipe.ingredients) {
    const inv = input.inventoryById.get(ing.inventoryItemId);
    if (!inv) {
      unknown.push(ing.inventoryItemId);
      continue;
    }
    // unitCost is per base unit; quantityMilli is base unit × 1000.
    const cost = divRoundHalfEven(inv.unitCost * ing.quantityMilli, BigInt(1000));
    breakdown.push({ inventoryItemId: ing.inventoryItemId, cost });
  }

  return {
    totalCost: sum(breakdown.map((b) => b.cost)),
    byIngredient: breakdown,
    unknownIngredients: unknown,
  };
}

/**
 * Stock deductions for a sold quantity of a menu item.
 * Returns ingredient deltas in base unit × 1000 (to be applied as `StockMovement.deltaMilli`).
 */
export function recipeDeductions(
  recipe: RecipeInput,
  quantity: number,
): { inventoryItemId: string; deltaMilli: bigint }[] {
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new RangeError('quantity must be positive integer');
  return recipe.ingredients.map((ing) => ({
    inventoryItemId: ing.inventoryItemId,
    deltaMilli: -(ing.quantityMilli * BigInt(quantity)),
  }));
}

export const _empty: RecipeCostBreakdown = {
  totalCost: ZERO,
  byIngredient: [],
  unknownIngredients: [],
};
