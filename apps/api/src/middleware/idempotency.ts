/**
 * `Idempotency-Key` header support. AGENTS.md §9.3.
 * Stored in Redis with response cache for 24h.
 */

import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { redis, tenantKey } from '../redis.js';
import type { RequestVars } from '../context.js';

const IDEMPOTENT_METHODS = new Set(['POST', 'PATCH', 'DELETE']);
const TTL_SECONDS = 24 * 3600;

export const idempotency: MiddlewareHandler<{ Variables: RequestVars }> = async (c, next) => {
  if (!IDEMPOTENT_METHODS.has(c.req.method)) {
    await next();
    return;
  }
  const key = c.req.header('idempotency-key');
  if (!key) {
    await next();
    return;
  }

  const id = c.get('identity');
  const tenantId = id?.tenantId ?? 'anon';
  const bodyText = await c.req.text();
  const requestHash = createHash('sha256').update(`${c.req.path}:${bodyText}`).digest('hex');
  const cacheKey = tenantKey(tenantId, 'idem', key);

  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as { hash: string; status: number; body: unknown };
    if (parsed.hash !== requestHash) {
      return c.json(
        {
          type: 'https://docs.desain.id/errors/idempotency-conflict',
          title: 'idempotency conflict',
          status: 409,
          detail: 'Idempotency-Key reused with different payload.',
          code: 'CONFLICT',
        },
        409,
      );
    }
    c.header('idempotent-replayed', 'true');
    return c.json(parsed.body, parsed.status as 200);
  }

  // Re-attach the body the handler will read.
  // Hono caches `c.req.text()` so it's safe to call again downstream.
  await next();

  // Cache successful responses only.
  const status = c.res.status;
  if (status < 500) {
    const body = await c.res.clone().text();
    await redis.set(
      cacheKey,
      JSON.stringify({ hash: requestHash, status, body: body ? safeParse(body) : null }),
      'EX',
      TTL_SECONDS,
    );
  }
};

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
