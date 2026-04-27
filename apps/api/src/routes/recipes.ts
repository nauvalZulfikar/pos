import { and, db, eq, schema } from '@desain/db';
import { computeRecipeCost } from '@desain/domain';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const recipeRouter = new Hono<{ Variables: RequestVars }>();

recipeRouter.use('*', authRequired, tenantContext, requireFeatures(['inventory_recipe']));

recipeRouter.get('/', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.recipes.findMany({
    where: eq(schema.recipes.tenantId, id.tenantId),
  });
  return c.json({ items: rows });
});

recipeRouter.get('/menu/:menuItemId', async (c) => {
  const id = c.get('identity');
  const menuItemId = c.req.param('menuItemId');
  const recipe = await db.query.recipes.findFirst({
    where: and(
      eq(schema.recipes.tenantId, id.tenantId),
      eq(schema.recipes.menuItemId, menuItemId),
    ),
  });
  if (!recipe) return c.json({ recipe: null });

  // Compute current food cost
  const ingredients = recipe.ingredients as Array<{ inventoryItemId: string; quantityMilli: string }>;
  const inventoryIds = ingredients.map((i) => i.inventoryItemId);
  const lookup = new Map<string, { unitCost: bigint }>();
  for (const iid of inventoryIds) {
    const inv = await db.query.inventoryItems.findFirst({
      where: and(
        eq(schema.inventoryItems.id, iid),
        eq(schema.inventoryItems.tenantId, id.tenantId),
      ),
    });
    if (inv) lookup.set(iid, { unitCost: inv.unitCost });
  }
  const costing = computeRecipeCost({
    recipe: {
      ingredients: ingredients.map((i) => ({
        inventoryItemId: i.inventoryItemId,
        quantityMilli: BigInt(i.quantityMilli),
      })),
    },
    inventoryById: lookup,
  });

  return c.json({
    recipe,
    foodCost: costing.totalCost.toString(),
    breakdown: costing.byIngredient.map((b) => ({
      inventoryItemId: b.inventoryItemId,
      cost: b.cost.toString(),
    })),
    unknownIngredients: costing.unknownIngredients,
  });
});

const RecipeIngredient = z.object({
  inventoryItemId: z.string().uuid(),
  quantityMilli: z.coerce.bigint(),
});

const SaveRecipeInput = z.object({
  menuItemId: z.string().uuid(),
  ingredients: z.array(RecipeIngredient),
  autoDeduct: z.boolean().default(true),
});

recipeRouter.put('/menu/:menuItemId', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const menuItemId = c.req.param('menuItemId');
  const input = SaveRecipeInput.parse({ ...(await c.req.json()), menuItemId });

  const ingredientsJson = input.ingredients.map((i) => ({
    inventoryItemId: i.inventoryItemId,
    quantityMilli: i.quantityMilli.toString(),
  }));

  const existing = await db.query.recipes.findFirst({
    where: and(
      eq(schema.recipes.tenantId, id.tenantId),
      eq(schema.recipes.menuItemId, menuItemId),
    ),
  });

  if (existing) {
    await db
      .update(schema.recipes)
      .set({
        ingredients: ingredientsJson,
        autoDeduct: input.autoDeduct,
        updatedAt: new Date(),
      })
      .where(eq(schema.recipes.id, existing.id));
    return c.json({ ok: true, recipeId: existing.id });
  }

  const newId = uuidv7();
  await db.insert(schema.recipes).values({
    id: newId,
    tenantId: id.tenantId,
    menuItemId,
    ingredients: ingredientsJson,
    autoDeduct: input.autoDeduct,
  });
  return c.json({ ok: true, recipeId: newId }, 201);
});

recipeRouter.delete('/menu/:menuItemId', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const menuItemId = c.req.param('menuItemId');
  await db
    .delete(schema.recipes)
    .where(
      and(
        eq(schema.recipes.tenantId, id.tenantId),
        eq(schema.recipes.menuItemId, menuItemId),
      ),
    );
  return c.json({ ok: true });
});
