import { Hono } from 'hono';
import { sql, db } from '@desain/db';
import { redis } from '../redis.js';
import type { RequestVars } from '../context.js';

export const healthRouter = new Hono<{ Variables: RequestVars }>();

healthRouter.get('/healthz', (c) => c.json({ ok: true }));

healthRouter.get('/readyz', async (c) => {
  const checks: Record<string, 'ok' | string> = {};
  try {
    await db.execute(sql`select 1`);
    checks.db = 'ok';
  } catch (err) {
    checks.db = (err as Error).message;
  }
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (err) {
    checks.redis = (err as Error).message;
  }
  const ready = Object.values(checks).every((v) => v === 'ok');
  return c.json({ ready, checks }, ready ? 200 : 503);
});
