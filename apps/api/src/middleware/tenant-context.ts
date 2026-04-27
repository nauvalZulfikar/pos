import { sql } from 'drizzle-orm';
import { db } from '@desain/db';
import type { MiddlewareHandler } from 'hono';
import type { RequestVars } from '../context.js';

/**
 * Per-request RLS variable binding. Sets a session-level config so subsequent
 * `db.execute` calls within the request inherit the tenant id. AGENTS.md §7.
 *
 * Note: postgres.js connections are pooled; we use `set local` inside
 * `withTenantContext` for transaction-scoped writes. For read-only handlers
 * that don't open a transaction, the entitlement guard + middleware order is
 * still the source of truth.
 */
export const tenantContext: MiddlewareHandler<{ Variables: RequestVars }> = async (c, next) => {
  const id = c.get('identity');
  if (!id) return next();
  // Bind session-level for read paths.
  await db.execute(sql`select set_config('app.current_tenant_id', ${id.tenantId}, false)`);
  await db.execute(sql`select set_config('app.current_user_id', ${id.userId}, false)`);
  if (id.outletId)
    await db.execute(sql`select set_config('app.current_outlet_id', ${id.outletId}, false)`);
  await next();
};
