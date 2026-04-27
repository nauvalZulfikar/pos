import { eq, and, isNull, desc, db, schema } from '@desain/db';
import { CreateMenuItemInput } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const menuRouter = new Hono<{ Variables: RequestVars }>();

menuRouter.use('*', authRequired, tenantContext);

// ───────────────────────────────────────────────────────────── Categories ──

menuRouter.get('/categories', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.menuCategories.findMany({
    where: and(
      eq(schema.menuCategories.tenantId, id.tenantId),
      isNull(schema.menuCategories.deletedAt),
    ),
    orderBy: [schema.menuCategories.sortOrder],
  });
  return c.json({ items: rows });
});

const CreateCategoryInput = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  iconKey: z.string().max(40).nullable().optional(),
});

menuRouter.post('/categories', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateCategoryInput.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.menuCategories).values({
    id: newId,
    tenantId: id.tenantId,
    name: input.name,
    sortOrder: input.sortOrder,
    iconKey: input.iconKey ?? null,
    isActive: true,
  });
  const created = await db.query.menuCategories.findFirst({
    where: eq(schema.menuCategories.id, newId),
  });
  return c.json({ category: created }, 201);
});

menuRouter.patch('/categories/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const catId = c.req.param('id');
  const input = CreateCategoryInput.partial().parse(await c.req.json());
  const updated = await db
    .update(schema.menuCategories)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(schema.menuCategories.id, catId),
        eq(schema.menuCategories.tenantId, id.tenantId),
      ),
    )
    .returning();
  if (updated.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ category: updated[0] });
});

menuRouter.delete('/categories/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const catId = c.req.param('id');
  // Check if any active menu items still in this category
  const remaining = await db.query.menuItems.findFirst({
    where: and(
      eq(schema.menuItems.tenantId, id.tenantId),
      eq(schema.menuItems.categoryId, catId),
      isNull(schema.menuItems.deletedAt),
    ),
  });
  if (remaining) {
    return c.json(
      {
        type: 'https://docs.desain.id/errors/conflict',
        title: 'category not empty',
        status: 409,
        code: 'CONFLICT',
        detail: 'Pindahkan dulu semua item ke kategori lain sebelum menghapus.',
      },
      409,
    );
  }
  await db
    .update(schema.menuCategories)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(schema.menuCategories.id, catId),
        eq(schema.menuCategories.tenantId, id.tenantId),
      ),
    );
  return c.json({ ok: true });
});

// ───────────────────────────────────────────────────────── Modifier Groups ──

menuRouter.get('/modifier-groups', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.modifierGroups.findMany({
    where: and(
      eq(schema.modifierGroups.tenantId, id.tenantId),
      isNull(schema.modifierGroups.deletedAt),
    ),
  });
  return c.json({ items: rows });
});

const ModifierInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  priceDelta: z.coerce.bigint(),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
});

const CreateModifierGroup = z.object({
  name: z.string().min(1).max(80),
  selectionMin: z.coerce.number().int().min(0).default(0),
  selectionMax: z.coerce.number().int().min(1).default(1),
  required: z.boolean().default(false),
  modifiers: z.array(ModifierInput).default([]),
});

menuRouter.post('/modifier-groups', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateModifierGroup.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.modifierGroups).values({
    id: newId,
    tenantId: id.tenantId,
    name: input.name,
    selectionMin: input.selectionMin,
    selectionMax: input.selectionMax,
    required: input.required,
    modifiers: input.modifiers.map((m) => ({
      id: m.id ?? uuidv7(),
      name: m.name,
      priceDelta: m.priceDelta.toString(),
      isDefault: m.isDefault,
      sortOrder: m.sortOrder,
    })),
  });
  const created = await db.query.modifierGroups.findFirst({
    where: eq(schema.modifierGroups.id, newId),
  });
  return c.json({ group: created }, 201);
});

menuRouter.patch('/modifier-groups/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const groupId = c.req.param('id');
  const input = CreateModifierGroup.partial().parse(await c.req.json());
  const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.modifiers) {
    patch.modifiers = input.modifiers.map((m) => ({
      id: m.id ?? uuidv7(),
      name: m.name,
      priceDelta: m.priceDelta.toString(),
      isDefault: m.isDefault,
      sortOrder: m.sortOrder,
    }));
  }
  const updated = await db
    .update(schema.modifierGroups)
    .set(patch)
    .where(
      and(
        eq(schema.modifierGroups.id, groupId),
        eq(schema.modifierGroups.tenantId, id.tenantId),
      ),
    )
    .returning();
  if (updated.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ group: updated[0] });
});

menuRouter.delete('/modifier-groups/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const groupId = c.req.param('id');
  await db
    .update(schema.modifierGroups)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(schema.modifierGroups.id, groupId),
        eq(schema.modifierGroups.tenantId, id.tenantId),
      ),
    );
  return c.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────── Items ──

menuRouter.get('/items', async (c) => {
  const id = c.get('identity');
  const categoryId = c.req.query('categoryId');
  const where = and(
    eq(schema.menuItems.tenantId, id.tenantId),
    isNull(schema.menuItems.deletedAt),
    categoryId ? eq(schema.menuItems.categoryId, categoryId) : undefined,
  );
  const rows = await db.query.menuItems.findMany({
    where,
    orderBy: [desc(schema.menuItems.updatedAt)],
    limit: 500,
  });
  return c.json({ items: rows });
});

menuRouter.post('/items', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateMenuItemInput.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.menuItems).values({
    id: newId,
    tenantId: id.tenantId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description,
    sku: input.sku,
    basePrice: input.basePrice,
    pricingByProfile: input.pricingByProfile,
    outletOverrides: [],
    imageUrl: input.imageUrl,
    modifierGroupIds: input.modifierGroupIds,
    isActive: true,
    ppnBpsOverride: input.ppnBpsOverride,
  });
  const created = await db.query.menuItems.findFirst({ where: eq(schema.menuItems.id, newId) });
  return c.json({ item: created }, 201);
});

const UpdateMenuItem = CreateMenuItemInput.partial();

menuRouter.patch('/items/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const itemId = c.req.param('id');
  const input = UpdateMenuItem.parse(await c.req.json());
  const updated = await db
    .update(schema.menuItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.tenantId, id.tenantId)))
    .returning();
  if (updated.length === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ item: updated[0] });
});

menuRouter.delete('/items/:id', requirePermission('menu:edit'), async (c) => {
  const id = c.get('identity');
  const itemId = c.req.param('id');
  await db
    .update(schema.menuItems)
    .set({ deletedAt: new Date() })
    .where(and(eq(schema.menuItems.id, itemId), eq(schema.menuItems.tenantId, id.tenantId)));
  return c.json({ ok: true });
});
