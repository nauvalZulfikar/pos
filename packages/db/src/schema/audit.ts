import { sql } from 'drizzle-orm';
import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Append-only audit log. AGENTS.md §2.4, §10.3.
 *
 * No update/delete is allowed at the trigger level (see infra/sql/audit.sql).
 * Inserts come from Postgres triggers on auditable tables — never from the app.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    actorUserId: uuid('actor_user_id'),
    actorRole: text('actor_role'),
    actorOutletId: uuid('actor_outlet_id'),
    deviceId: uuid('device_id'),
    /** Table name. */
    entityKind: text('entity_kind').notNull(),
    entityId: text('entity_id'),
    operation: text('operation').notNull(),
    diff: jsonb('diff').notNull(),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (t) => ({
    tenantOccurredIdx: index('audit_logs_tenant_occurred_idx').on(t.tenantId, t.occurredAt),
    entityIdx: index('audit_logs_entity_idx').on(t.tenantId, t.entityKind, t.entityId),
  }),
);

export type AuditLog = typeof auditLogs.$inferSelect;
