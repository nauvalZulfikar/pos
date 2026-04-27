import { describe, expect, it } from 'vitest';
import { planRecipeDeductions } from './stock-deduction.js';

describe('planRecipeDeductions', () => {
  it('sums shared ingredients across multiple sold lines', () => {
    // Both Nasi Goreng and Mie Goreng use 30g garlic per dish.
    const recipes = new Map([
      [
        'nasgor',
        {
          autoDeduct: true,
          ingredients: [
            { inventoryItemId: 'rice', quantityMilli: BigInt(150 * 1000) },
            { inventoryItemId: 'garlic', quantityMilli: BigInt(30 * 1000) },
          ],
        },
      ],
      [
        'miegor',
        {
          autoDeduct: true,
          ingredients: [
            { inventoryItemId: 'noodle', quantityMilli: BigInt(120 * 1000) },
            { inventoryItemId: 'garlic', quantityMilli: BigInt(30 * 1000) },
          ],
        },
      ],
    ]);

    const plan = planRecipeDeductions({
      lines: [
        { menuItemId: 'nasgor', quantity: 2 },
        { menuItemId: 'miegor', quantity: 1 },
      ],
      recipesByMenuItemId: recipes,
    });

    // Sorted by inventoryItemId
    expect(plan.deltas).toEqual([
      { inventoryItemId: 'garlic', deltaMilli: BigInt(-(30 * 1000) * 3) }, // 2 + 1
      { inventoryItemId: 'noodle', deltaMilli: BigInt(-(120 * 1000) * 1) },
      { inventoryItemId: 'rice', deltaMilli: BigInt(-(150 * 1000) * 2) },
    ]);
    expect(plan.skippedMenuItems).toEqual([]);
  });

  it('skips items without recipe', () => {
    const plan = planRecipeDeductions({
      lines: [{ menuItemId: 'water', quantity: 1 }],
      recipesByMenuItemId: new Map(),
    });
    expect(plan.deltas).toEqual([]);
    expect(plan.skippedMenuItems).toEqual(['water']);
  });

  it('skips items with autoDeduct=false', () => {
    const plan = planRecipeDeductions({
      lines: [{ menuItemId: 'special', quantity: 1 }],
      recipesByMenuItemId: new Map([
        [
          'special',
          {
            autoDeduct: false,
            ingredients: [{ inventoryItemId: 'x', quantityMilli: BigInt(1) }],
          },
        ],
      ]),
    });
    expect(plan.deltas).toEqual([]);
    expect(plan.skippedMenuItems).toEqual(['special']);
  });

  it('rejects non-positive quantity', () => {
    expect(() =>
      planRecipeDeductions({
        lines: [{ menuItemId: 'x', quantity: 0 }],
        recipesByMenuItemId: new Map(),
      }),
    ).toThrow();
    expect(() =>
      planRecipeDeductions({
        lines: [{ menuItemId: 'x', quantity: 1.5 }],
        recipesByMenuItemId: new Map(),
      }),
    ).toThrow();
  });

  it('handles empty input', () => {
    const plan = planRecipeDeductions({ lines: [], recipesByMenuItemId: new Map() });
    expect(plan.deltas).toEqual([]);
    expect(plan.skippedMenuItems).toEqual([]);
  });
});
