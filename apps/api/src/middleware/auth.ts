/**
 * Auth middleware. Reads session token from cookie or Authorization header,
 * loads user + tenant + role + permissions, populates `identity`.
 *
 * AGENTS.md §11.
 */

import { ProblemError } from '@desain/types';
import { eq, and, isNull, db, schema } from '@desain/db';
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Permission, Role } from '@desain/types';
import { ROLE_DEFAULT_PERMISSIONS } from '@desain/types';
import type { RequestVars } from '../context.js';

const SESSION_COOKIE = 'desain_sid';

export const authRequired: MiddlewareHandler<{ Variables: RequestVars }> = async (c, next) => {
  const token = extractToken(c);
  if (!token) throw new ProblemError(401, 'AUTH_REQUIRED', 'Authentication required.');

  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.id, token)),
  });
  if (!session) throw new ProblemError(401, 'AUTH_INVALID', 'Session not found.');
  if (session.expiresAt < new Date()) throw new ProblemError(401, 'AUTH_INVALID', 'Session expired.');
  if (!session.activeTenantId)
    throw new ProblemError(401, 'AUTH_INVALID', 'Session has no active tenant.');

  const membership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.tenantId, session.activeTenantId),
      eq(schema.memberships.userId, session.userId),
      eq(schema.memberships.isActive, true),
      isNull(schema.memberships.deletedAt),
    ),
  });
  if (!membership) throw new ProblemError(403, 'PERMISSION_DENIED', 'No active membership.');

  const role = membership.role as Role;
  const permissions = new Set<Permission>(ROLE_DEFAULT_PERMISSIONS[role]);
  // outletPermissions overrides
  const outletId = session.outletId;
  if (outletId) {
    type OverrideEntry = { outletId: string; permissions: Permission[] };
    const overrides = membership.outletPermissions as OverrideEntry[];
    const ov = overrides.find((o) => o.outletId === outletId);
    if (ov) {
      for (const p of ov.permissions) permissions.add(p);
    }
  }

  c.set('identity', {
    userId: session.userId,
    tenantId: session.activeTenantId,
    outletId,
    deviceId: session.deviceId,
    role,
    permissions,
    sessionId: session.id,
  });

  await next();
};

function extractToken(c: Parameters<MiddlewareHandler>[0]): string | null {
  const cookie = getCookie(c, SESSION_COOKIE);
  if (cookie) return cookie;
  const auth = c.req.header('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice('Bearer '.length);
  return null;
}
