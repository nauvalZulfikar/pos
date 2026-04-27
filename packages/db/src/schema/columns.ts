/**
 * Reusable column builders. Every tenant entity gets `tenantOwnedColumns`.
 */

import { sql } from 'drizzle-orm';
import { boolean, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Common audit + soft-delete columns. */
export const baseColumns = {
  id: uuid('id').primaryKey().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  /** Set when row was created offline; used for sync deduplication. */
  clientOpId: uuid('client_op_id'),
};

/** Tenant FK on every tenant-owned table. RLS uses this column. */
export const tenantColumn = {
  tenantId: uuid('tenant_id').notNull(),
};

export const tenantOwnedColumns = {
  ...baseColumns,
  ...tenantColumn,
};

export const isActiveColumn = {
  isActive: boolean('is_active').notNull().default(true),
};
