/**
 * Database client.
 *
 * Two pools:
 *   - `db`        : tenant-scoped, RLS enforced. Used by user-facing handlers.
 *   - `dbAdmin`   : RLS bypass. Used ONLY by internal/staff tooling.
 *
 * AGENTS.md §7.3.
 */

import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

const url = process.env.DATABASE_URL;
const adminUrl = process.env.DATABASE_ADMIN_URL ?? url;

if (!url) {
  throw new Error('DATABASE_URL must be set');
}

export const sqlClient = postgres(url, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  prepare: false,
  connection: {
    application_name: 'desain-api',
  },
});

export const sqlAdminClient = postgres(adminUrl!, {
  max: Number(process.env.DATABASE_ADMIN_POOL_MAX ?? 2),
  prepare: false,
  connection: {
    application_name: 'desain-admin-bypass',
  },
});

export const db = drizzlePg(sqlClient, { schema });
export const dbAdmin = drizzlePg(sqlAdminClient, { schema });

export type Database = typeof db;
