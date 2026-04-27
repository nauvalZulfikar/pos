/**
 * Apply RLS policies + audit triggers. Run after every Drizzle migration.
 * Uses main DATABASE_URL (table owner) so it can ALTER tables and CREATE TRIGGER.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL must be set');

  const sql = postgres(url, { max: 1, prepare: false });

  const policies = await readFile(join(__dirname, 'policies.sql'), 'utf8');
  const triggers = await readFile(join(__dirname, 'audit-triggers.sql'), 'utf8');

  console.warn('[rls] applying policies…');
  await sql.unsafe(policies);
  console.warn('[rls] applying audit triggers…');
  await sql.unsafe(triggers);
  console.warn('[rls] done.');
  await sql.end();
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
