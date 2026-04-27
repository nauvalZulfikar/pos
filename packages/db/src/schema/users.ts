import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { baseColumns, tenantOwnedColumns } from './columns';

export const users = pgTable(
  'users',
  {
    ...baseColumns,
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone'),
    /** Argon2id password hash. Nullable for kasir-only accounts. */
    passwordHash: text('password_hash'),
    /** Argon2id PIN hash (4 digits + per-user salt). */
    pinHash: text('pin_hash'),
    isActive: boolean('is_active').notNull().default(true),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => ({
    emailUq: uniqueIndex('users_email_uq').on(t.email),
  }),
);

export const memberships = pgTable(
  'memberships',
  {
    ...tenantOwnedColumns,
    userId: uuid('user_id').notNull(),
    role: text('role').notNull(),
    /** Outlet-scoped permission overrides. */
    outletPermissions: jsonb('outlet_permissions').notNull().default(sql`'[]'::jsonb`),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => ({
    tenantIdx: index('memberships_tenant_idx').on(t.tenantId),
    userIdx: index('memberships_user_idx').on(t.userId),
    tenantUserUq: uniqueIndex('memberships_tenant_user_uq')
      .on(t.tenantId, t.userId)
      .where(sql`deleted_at is null`),
  }),
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id').notNull(),
    /** When the user is acting on behalf of a tenant. */
    activeTenantId: uuid('active_tenant_id'),
    /** Optional outlet for terminal-bound sessions. */
    outletId: uuid('outlet_id'),
    deviceId: uuid('device_id'),
    sessionType: text('session_type').notNull().default('web'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
  },
  (t) => ({
    userIdx: index('sessions_user_idx').on(t.userId),
    expiresIdx: index('sessions_expires_idx').on(t.expiresAt),
  }),
);

export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Session = typeof sessions.$inferSelect;
