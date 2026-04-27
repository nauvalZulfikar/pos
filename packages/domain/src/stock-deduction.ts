/**
 * Stock-deduction planning. Pure function.
 *
 * Given a list of (menuItemId, qty) and a recipe lookup, return the per-ingredient
 * deltas to apply. Multiple lines deducting the same ingredient are summed so we
 * write one stock_movement per ingredient per order.
 */

import type { RecipeIngredientInput, RecipeInput } from './recipe.js';

export type SoldLine = {
  menuItemId: string;
  quantity: number;
};

export type IngredientDelta = {
  inventoryItemId: string;
  deltaMilli: bigint;
};

export type DeductionPlan = {
  deltas: IngredientDelta[];
  /** Menu items in the sale that have no recipe — these are skipped (e.g. resold drinks). */
  skippedMenuItems: string[];
};

export function planRecipeDeductions(args: {
  lines: readonly SoldLine[];
  recipesByMenuItemId: ReadonlyMap<string, RecipeInput & { autoDeduct: boolean }>;
}): DeductionPlan {
  const sums = new Map<string, bigint>();
  const skipped: string[] = [];

  for (const line of args.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`invalid quantity for ${line.menuItemId}`);
    }
    const recipe = args.recipesByMenuItemId.get(line.menuItemId);
    if (!recipe || !recipe.autoDeduct) {
      skipped.push(line.menuItemId);
      continue;
    }
    for (const ing of recipe.ingredients) {
      const consumed = ing.quantityMilli * BigInt(line.quantity);
      const prev = sums.get(ing.inventoryItemId) ?? BigInt(0);
      sums.set(ing.inventoryItemId, prev - consumed);
    }
  }

  const deltas: IngredientDelta[] = [];
  for (const [inventoryItemId, deltaMilli] of sums) {
    deltas.push({ inventoryItemId, deltaMilli });
  }
  // Stable, deterministic order — easier diffs in tests + audit.
  deltas.sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));

  return { deltas, skippedMenuItems: skipped };
}

export type { RecipeIngredientInput };
