/**
 * Apply Drizzle migrations + RLS + audit triggers in one shot.
 * Uses the regular DATABASE_URL (table owner) to avoid schema-permission issues
 * with the bypassrls role.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.warn('[migrate] running drizzle migrations...');
  await migrate(db, { migrationsFolder: join(rootDir, 'drizzle') });

  console.warn('[migrate] applying RLS policies...');
  const policies = await readFile(join(__dirname, 'rls/policies.sql'), 'utf8');
  await sql.unsafe(policies);

  console.warn('[migrate] applying audit triggers...');
  const triggers = await readFile(join(__dirname, 'rls/audit-triggers.sql'), 'utf8');
  await sql.unsafe(triggers);

  console.warn('[migrate] done.');
  await sql.end();
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
