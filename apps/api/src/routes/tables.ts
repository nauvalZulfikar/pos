import { and, db, eq, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const tablesRouter = new Hono<{ Variables: RequestVars }>();

tablesRouter.use('*', authRequired, tenantContext, requireFeatures(['table_management']));

tablesRouter.get('/', async (c) => {
  const id = c.get('identity');
  const outletId = c.req.query('outletId') ?? id.outletId;
  if (!outletId) throw new ProblemError(400, 'VALIDATION_FAILED', 'outletId required');
  const rows = await db.query.tables.findMany({
    where: and(
      eq(schema.tables.tenantId, id.tenantId),
      eq(schema.tables.outletId, outletId),
    ),
  });
  return c.json({ items: rows });
});

const CreateTable = z.object({
  outletId: z.string().uuid(),
  label: z.string().min(1).max(20),
  capacity: z.coerce.number().int().min(1).max(50).default(2),
});

tablesRouter.post('/', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateTable.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.tables).values({
    id: newId,
    tenantId: id.tenantId,
    outletId: input.outletId,
    label: input.label,
    capacity: input.capacity,
    status: 'available',
  });
  return c.json({ id: newId }, 201);
});

const UpdateStatus = z.object({
  status: z.enum(['available', 'occupied', 'reserved', 'cleaning']),
});

tablesRouter.patch('/:id/status', requirePermission('order:create'), async (c) => {
  const id = c.get('identity');
  const tableId = c.req.param('id');
  const input = UpdateStatus.parse(await c.req.json());
  await db
    .update(schema.tables)
    .set({ status: input.status, updatedAt: new Date() })
    .where(and(eq(schema.tables.id, tableId), eq(schema.tables.tenantId, id.tenantId)));
  return c.json({ ok: true });
});
