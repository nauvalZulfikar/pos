import { and, db, desc, eq, gte, schema } from '@desain/db';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireAnyFeatures } from '../middleware/entitlement.js';
import { enqueueMenuScore, enqueueDemandForecast } from '../queues.js';
import type { RequestVars } from '../context.js';

export const aiRouter = new Hono<{ Variables: RequestVars }>();

aiRouter.use(
  '*',
  authRequired,
  tenantContext,
  requireAnyFeatures([
    'ai_daily_brief',
    'ai_menu_scoring',
    'ai_anomaly_detection',
    'ai_demand_forecasting',
  ]),
  requirePermission('reports:view'),
);

aiRouter.get('/daily-briefs', async (c) => {
  const id = c.get('identity');
  const limit = Number(c.req.query('limit') ?? '14');
  const rows = await db.query.dailyBriefs.findMany({
    where: eq(schema.dailyBriefs.tenantId, id.tenantId),
    orderBy: [desc(schema.dailyBriefs.businessDay)],
    limit: Math.min(60, Math.max(1, limit)),
  });
  return c.json({ items: rows });
});

aiRouter.get('/menu-scores', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.menuPerformanceScores.findMany({
    where: eq(schema.menuPerformanceScores.tenantId, id.tenantId),
    orderBy: [desc(schema.menuPerformanceScores.periodEnd)],
    limit: 200,
  });
  return c.json({ items: rows });
});

aiRouter.post('/menu-scores/refresh', async (c) => {
  const id = c.get('identity');
  await enqueueMenuScore(id.tenantId);
  return c.json({ ok: true, queued: true });
});

aiRouter.get('/anomalies', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.anomalies.findMany({
    where: and(eq(schema.anomalies.tenantId, id.tenantId)),
    orderBy: [desc(schema.anomalies.detectedAt)],
    limit: 100,
  });
  return c.json({ items: rows });
});

aiRouter.get('/demand-forecasts', async (c) => {
  const id = c.get('identity');
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.query.demandForecasts.findMany({
    where: and(
      eq(schema.demandForecasts.tenantId, id.tenantId),
      gte(schema.demandForecasts.targetDay, today),
    ),
    orderBy: [schema.demandForecasts.targetDay],
    limit: 1000,
  });
  return c.json({ items: rows });
});

aiRouter.post('/demand-forecasts/refresh', async (c) => {
  const id = c.get('identity');
  await enqueueDemandForecast(id.tenantId);
  return c.json({ ok: true, queued: true });
});
