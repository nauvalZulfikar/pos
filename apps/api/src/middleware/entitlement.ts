import { eq, and, db, schema, sql } from '@desain/db';
import { buildFeatureMap, requireFeature } from '@desain/domain';
import type { FeatureCode } from '@desain/types';
import type { Context, MiddlewareHandler } from 'hono';
import { tenantKey, redis } from '../redis.js';
import type { RequestVars } from '../context.js';

const CACHE_TTL_SEC = 60;

async function loadEnabledFeatures(tenantId: string): Promise<FeatureCode[]> {
  const cacheKey = tenantKey(tenantId, 'features:enabled');
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as FeatureCode[];

  // Bind RLS variable for this query so the tenant_features rows are visible.
  await db.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, false)`);

  const rows = await db.query.tenantFeatures.findMany({
    where: and(
      eq(schema.tenantFeatures.tenantId, tenantId),
      eq(schema.tenantFeatures.enabled, true),
    ),
  });
  const now = new Date();
  const codes = rows
    .filter((r) => !r.expiresAt || r.expiresAt > now)
    .map((r) => r.featureCode as FeatureCode);
  await redis.set(cacheKey, JSON.stringify(codes), 'EX', CACHE_TTL_SEC);
  return codes;
}

async function ensureFeatureMap(c: Context<{ Variables: RequestVars }>) {
  let map = c.get('features');
  if (!map || Object.keys(map).length === 0) {
    const id = c.get('identity');
    if (id) {
      const enabled = await loadEnabledFeatures(id.tenantId);
      map = buildFeatureMap(enabled);
      c.set('features', map);
    } else {
      map = buildFeatureMap([]);
    }
  }
  return map;
}

/**
 * Loads `c.var.features` if identity is already set. Safe to install at /v1/* level
 * even before auth — for unauthenticated requests, it just sets an empty map.
 */
export const loadFeatures: MiddlewareHandler<{ Variables: RequestVars }> = async (c, next) => {
  await ensureFeatureMap(c);
  await next();
};

/**
 * Per-route guard. ALL listed features must be enabled.
 * Lazy-loads features if not already populated.
 */
export function requireFeatures(
  codes: readonly FeatureCode[],
): MiddlewareHandler<{ Variables: RequestVars }> {
  return async (c, next) => {
    const map = await ensureFeatureMap(c);
    for (const code of codes) requireFeature({ features: map }, code);
    await next();
  };
}

/**
 * Per-route guard. AT LEAST ONE listed feature must be enabled.
 * Useful for delivery aggregator routes that work as long as any one platform is active.
 */
export function requireAnyFeatures(
  codes: readonly FeatureCode[],
): MiddlewareHandler<{ Variables: RequestVars }> {
  return async (c, next) => {
    const map = await ensureFeatureMap(c);
    if (codes.some((code) => map[code])) {
      await next();
      return;
    }
    requireFeature({ features: map }, codes[0]!);
  };
}
