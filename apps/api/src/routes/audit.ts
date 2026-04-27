import { and, db, desc, eq, gte, lte, schema } from '@desain/db';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const auditRouter = new Hono<{ Variables: RequestVars }>();

auditRouter.use('*', authRequired, tenantContext, requirePermission('reports:view'));

auditRouter.get('/logs', async (c) => {
  const id = c.get('identity');
  const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') ?? '50')));
  const entityKind = c.req.query('entityKind');
  const operation = c.req.query('operation');
  const from = c.req.query('from');
  const to = c.req.query('to');

  const rows = await db.query.auditLogs.findMany({
    where: and(
      eq(schema.auditLogs.tenantId, id.tenantId),
      entityKind ? eq(schema.auditLogs.entityKind, entityKind) : undefined,
      operation ? eq(schema.auditLogs.operation, operation) : undefined,
      from ? gte(schema.auditLogs.occurredAt, new Date(from)) : undefined,
      to ? lte(schema.auditLogs.occurredAt, new Date(to)) : undefined,
    ),
    orderBy: [desc(schema.auditLogs.occurredAt)],
    limit,
  });
  return c.json({ items: rows });
});
