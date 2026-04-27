import { createHash } from 'node:crypto';
import { and, db, desc, eq, isNull, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import { encryptPii } from '../crypto.js';
import type { RequestVars } from '../context.js';

export const customerRouter = new Hono<{ Variables: RequestVars }>();

customerRouter.use(
  '*',
  authRequired,
  tenantContext,
  requireFeatures(['customer_directory']),
);

function hashPhone(phone: string, tenantId: string): string {
  return createHash('sha256').update(`${normalize(phone)}|${tenantId}`).digest('hex');
}

function normalize(phone: string): string {
  return phone.replace(/[^\d+]/g, '');
}

customerRouter.get('/', async (c) => {
  const id = c.get('identity');
  const q = c.req.query('q');
  const phoneHash = q && /^\+?\d/.test(q) ? hashPhone(q, id.tenantId) : null;
  const rows = await db.query.customers.findMany({
    where: and(
      eq(schema.customers.tenantId, id.tenantId),
      isNull(schema.customers.deletedAt),
      phoneHash ? eq(schema.customers.phoneHash, phoneHash) : undefined,
    ),
    orderBy: [desc(schema.customers.lastVisitAt)],
    limit: 200,
  });
  return c.json({ items: rows });
});

const CreateCustomerInput = z.object({
  fullName: z.string().min(1).max(120),
  phone: z.string().regex(/^\+?\d{8,15}$/).nullable().optional(),
  email: z.string().email().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

customerRouter.post('/', requirePermission('order:create'), async (c) => {
  const id = c.get('identity');
  const input = CreateCustomerInput.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.customers).values({
    id: newId,
    tenantId: id.tenantId,
    fullName: input.fullName,
    phoneHash: input.phone ? hashPhone(input.phone, id.tenantId) : null,
    phoneEncrypted: encryptPii(input.phone ?? null),
    email: input.email ?? null,
    tags: input.tags,
    isActive: true,
    visitCount: 0,
  });
  const created = await db.query.customers.findFirst({ where: eq(schema.customers.id, newId) });
  return c.json({ customer: created }, 201);
});

customerRouter.get('/:id', async (c) => {
  const id = c.get('identity');
  const customerId = c.req.param('id');
  const customer = await db.query.customers.findFirst({
    where: and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, id.tenantId)),
  });
  if (!customer) throw new ProblemError(404, 'NOT_FOUND', 'Customer not found');

  // Order history
  const orders = await db
    .select({
      id: schema.orders.id,
      outletOrderNumber: schema.orders.outletOrderNumber,
      total: schema.orders.total,
      paidAt: schema.orders.paidAt,
      status: schema.orders.status,
    })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.tenantId, id.tenantId),
        eq(schema.orders.customerName, customer.fullName),
      ),
    )
    .orderBy(desc(schema.orders.paidAt))
    .limit(50);

  return c.json({ customer, orders });
});

customerRouter.patch('/:id', requirePermission('order:create'), async (c) => {
  const id = c.get('identity');
  const customerId = c.req.param('id');
  const input = CreateCustomerInput.partial().parse(await c.req.json());
  const patch: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if (input.phone !== undefined) {
    patch.phoneHash = input.phone ? hashPhone(input.phone, id.tenantId) : null;
    patch.phoneEncrypted = encryptPii(input.phone ?? null);
    delete patch.phone;
  }
  await db
    .update(schema.customers)
    .set(patch)
    .where(
      and(eq(schema.customers.id, customerId), eq(schema.customers.tenantId, id.tenantId)),
    );
  return c.json({ ok: true });
});
