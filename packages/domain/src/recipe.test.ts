import { describe, expect, it } from 'vitest';
import { fromRupiah } from './money.js';
import { computeRecipeCost, recipeDeductions } from './recipe.js';

describe('recipe', () => {
  it('computes total cost from ingredients', () => {
    // 100g flour @ Rp 200/g  +  200ml milk @ Rp 50/ml = 20.000 + 10.000 = 30.000
    const inv = new Map([
      ['flour', { unitCost: fromRupiah(200) }],
      ['milk', { unitCost: fromRupiah(50) }],
    ]);
    const r = computeRecipeCost({
      recipe: {
        ingredients: [
          { inventoryItemId: 'flour' as never, quantityMilli: BigInt(100 * 1000) },
          { inventoryItemId: 'milk' as never, quantityMilli: BigInt(200 * 1000) },
        ],
      },
      inventoryById: inv,
    });
    expect(r.totalCost).toBe(fromRupiah(30_000));
    expect(r.byIngredient).toHaveLength(2);
    expect(r.unknownIngredients).toHaveLength(0);
  });

  it('reports unknown ingredients without throwing', () => {
    const r = computeRecipeCost({
      recipe: { ingredients: [{ inventoryItemId: 'ghost' as never, quantityMilli: BigInt(1000) }] },
      inventoryById: new Map(),
    });
    expect(r.totalCost).toBe(BigInt(0));
    expect(r.unknownIngredients).toContain('ghost');
  });

  it('recipeDeductions returns negative deltas per quantity', () => {
    const deltas = recipeDeductions(
      {
        ingredients: [
          { inventoryItemId: 'a' as never, quantityMilli: BigInt(50_000) },
          { inventoryItemId: 'b' as never, quantityMilli: BigInt(20_000) },
        ],
      },
      3,
    );
    expect(deltas).toHaveLength(2);
    expect(deltas[0]!.deltaMilli).toBe(BigInt(-150_000));
    expect(deltas[1]!.deltaMilli).toBe(BigInt(-60_000));
  });

  it('rejects non-positive quantity', () => {
    expect(() =>
      recipeDeductions({ ingredients: [] }, 0),
    ).toThrow();
    expect(() =>
      recipeDeductions({ ingredients: [] }, -1),
    ).toThrow();
    expect(() =>
      recipeDeductions({ ingredients: [] }, 1.5),
    ).toThrow();
  });
});
