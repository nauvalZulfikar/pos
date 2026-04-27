/**
 * `withTenantContext` — sets the RLS variable on the connection at the start of
 * a transaction. Every user-facing handler MUST go through this helper.
 * AGENTS.md §7.1, §7.2.
 *
 * Custom ESLint rule (`config/eslint/no-direct-db-call.mjs` — TODO) catches
 * direct calls to `db.execute / db.transaction` outside this file.
 */

import { sql } from 'drizzle-orm';
import { db } from './client.js';
import type { Database } from './client.js';

export type TenantContext = {
  tenantId: string;
  userId: string;
  outletId?: string;
};

export async function withTenantContext<T>(
  ctx: TenantContext,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.current_tenant_id', ${ctx.tenantId}, true)`,
    );
    await tx.execute(sql`select set_config('app.current_user_id', ${ctx.userId}, true)`);
    if (ctx.outletId)
      await tx.execute(sql`select set_config('app.current_outlet_id', ${ctx.outletId}, true)`);
    return fn(tx as unknown as Database);
  });
}
