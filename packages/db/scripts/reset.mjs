#!/usr/bin/env node
// Drop + recreate the dev schema. NEVER run against production.
import postgres from 'postgres';

const url = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_ADMIN_URL or DATABASE_URL must be set');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('refusing to reset in production');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await sql.unsafe('drop schema if exists public cascade; create schema public;');
  console.warn('[reset] dev schema dropped and recreated.');
} finally {
  await sql.end();
}
