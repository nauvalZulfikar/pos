import { and, db, eq, isNull, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const outletRouter = new Hono<{ Variables: RequestVars }>();

outletRouter.use('*', authRequired, tenantContext);

outletRouter.get('/', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.outlets.findMany({
    where: and(eq(schema.outlets.tenantId, id.tenantId), isNull(schema.outlets.deletedAt)),
  });
  return c.json({ items: rows });
});

const CreateOutletInput = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  addressLine1: z.string().max(200),
  addressLine2: z.string().max(200).nullable().optional(),
  city: z.string().max(80),
  province: z.string().max(80),
  postalCode: z.string().max(10).nullable().optional(),
  phone: z.string().max(20).nullable().optional(),
  ppnBpsOverride: z.coerce.number().int().min(0).max(2500).nullable().optional(),
  serviceChargeBps: z.coerce.number().int().min(0).max(2500).default(0),
  businessDayBoundary: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
});

outletRouter.post('/', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateOutletInput.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.outlets).values({
    id: newId,
    tenantId: id.tenantId,
    name: input.name,
    code: input.code,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 ?? null,
    city: input.city,
    province: input.province,
    postalCode: input.postalCode ?? null,
    phone: input.phone ?? null,
    ppnBpsOverride: input.ppnBpsOverride ?? null,
    serviceChargeBps: input.serviceChargeBps,
    businessDayBoundary: input.businessDayBoundary ?? null,
    isActive: true,
  });
  const created = await db.query.outlets.findFirst({ where: eq(schema.outlets.id, newId) });
  return c.json({ outlet: created }, 201);
});

outletRouter.patch('/:id', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const outletId = c.req.param('id');
  const input = CreateOutletInput.partial().parse(await c.req.json());
  await db
    .update(schema.outlets)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(schema.outlets.id, outletId), eq(schema.outlets.tenantId, id.tenantId)));
  return c.json({ ok: true });
});

outletRouter.delete('/:id', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const outletId = c.req.param('id');
  await db
    .update(schema.outlets)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(eq(schema.outlets.id, outletId), eq(schema.outlets.tenantId, id.tenantId)));
  return c.json({ ok: true });
});

outletRouter.get('/:id', async (c) => {
  const id = c.get('identity');
  const outletId = c.req.param('id');
  const outlet = await db.query.outlets.findFirst({
    where: and(eq(schema.outlets.id, outletId), eq(schema.outlets.tenantId, id.tenantId)),
  });
  if (!outlet) throw new ProblemError(404, 'NOT_FOUND', 'Outlet not found');
  return c.json({ outlet });
});
