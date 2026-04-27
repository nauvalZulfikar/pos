import { and, db, desc, eq, isNull, schema } from '@desain/db';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const suppliersRouter = new Hono<{ Variables: RequestVars }>();

suppliersRouter.use(
  '*',
  authRequired,
  tenantContext,
  requireFeatures(['supplier_management']),
);

suppliersRouter.get('/', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.suppliers.findMany({
    where: and(eq(schema.suppliers.tenantId, id.tenantId), isNull(schema.suppliers.deletedAt)),
  });
  return c.json({ items: rows });
});

const CreateSupplier = z.object({
  name: z.string().min(1).max(120),
  contactName: z.string().max(120).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  npwp: z.string().regex(/^\d{15,16}$/).nullable().optional(),
});

suppliersRouter.post('/', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateSupplier.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.suppliers).values({
    id: newId,
    tenantId: id.tenantId,
    name: input.name,
    contactName: input.contactName ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    address: input.address ?? null,
    npwp: input.npwp ?? null,
    isActive: true,
  });
  return c.json({ id: newId }, 201);
});

const PoItem = z.object({
  inventoryItemId: z.string().uuid(),
  quantityMilli: z.coerce.bigint().positive(),
  unitCost: z.coerce.bigint().nonnegative(),
});

const CreatePoInput = z.object({
  supplierId: z.string().uuid(),
  outletId: z.string().uuid(),
  poNumber: z.string().min(1).max(40),
  items: z.array(PoItem).min(1),
  expectedAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

suppliersRouter.post('/purchase-orders', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreatePoInput.parse(await c.req.json());
  const total = input.items.reduce(
    (acc, it) => acc + (it.unitCost * it.quantityMilli) / BigInt(1000),
    BigInt(0),
  );
  const newId = uuidv7();
  await db.insert(schema.purchaseOrders).values({
    id: newId,
    tenantId: id.tenantId,
    supplierId: input.supplierId,
    outletId: input.outletId,
    poNumber: input.poNumber,
    status: 'draft',
    items: input.items.map((i) => ({
      inventoryItemId: i.inventoryItemId,
      quantityMilli: i.quantityMilli.toString(),
      unitCost: i.unitCost.toString(),
    })),
    totalAmount: total,
    expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
    notes: input.notes ?? null,
    createdBy: id.userId,
  });
  return c.json({ id: newId }, 201);
});

suppliersRouter.get('/purchase-orders', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.purchaseOrders.findMany({
    where: eq(schema.purchaseOrders.tenantId, id.tenantId),
    orderBy: [desc(schema.purchaseOrders.createdAt)],
    limit: 100,
  });
  return c.json({ items: rows });
});
