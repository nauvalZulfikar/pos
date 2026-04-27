import { db, eq, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const tenantRouter = new Hono<{ Variables: RequestVars }>();

tenantRouter.use('*', authRequired, tenantContext);

tenantRouter.get('/me', async (c) => {
  const id = c.get('identity');
  const tenant = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, id.tenantId) });
  if (!tenant) throw new ProblemError(404, 'NOT_FOUND', 'Tenant not found');
  return c.json({ tenant });
});

const UpdateTenantInput = z.object({
  legalName: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(120).optional(),
  npwp: z.string().regex(/^\d{15,16}$/).nullable().optional(),
  isPkp: z.boolean().optional(),
  defaultLocale: z.enum(['id-ID', 'en-US']).optional(),
  defaultTimezone: z.string().optional(),
  businessDayBoundary: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

tenantRouter.patch('/me', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = UpdateTenantInput.parse(await c.req.json());
  await db
    .update(schema.tenants)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(schema.tenants.id, id.tenantId));
  const updated = await db.query.tenants.findFirst({ where: eq(schema.tenants.id, id.tenantId) });
  return c.json({ tenant: updated });
});

const ToggleFeatureInput = z.object({
  code: z.string(),
  enabled: z.boolean(),
});

tenantRouter.post('/features/toggle', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = ToggleFeatureInput.parse(await c.req.json());
  await db
    .insert(schema.tenantFeatures)
    .values({
      tenantId: id.tenantId,
      featureCode: input.code,
      enabled: input.enabled,
      source: 'subscription',
    })
    .onConflictDoUpdate({
      target: [schema.tenantFeatures.tenantId, schema.tenantFeatures.featureCode],
      set: { enabled: input.enabled, enabledAt: new Date() },
    });
  return c.json({ ok: true });
});
