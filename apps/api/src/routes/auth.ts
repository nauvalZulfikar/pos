/**
 * Auth endpoints: email+password login (admin), PIN login (terminal), logout.
 * AGENTS.md §11.
 */

import argon2 from 'argon2';
import { eq, and, isNull, db, schema, sql } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { redis, tenantKey } from '../redis.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { authRequired } from '../middleware/auth.js';
import type { RequestVars } from '../context.js';

const SESSION_COOKIE = 'desain_sid';
const SESSION_TTL_DAYS_WEB = 30;
const SESSION_TTL_DAYS_TERMINAL = 90;

export const authRouter = new Hono<{ Variables: RequestVars }>();

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  /** Optional: tenant to activate if user has multiple memberships. */
  tenantId: z.string().uuid().optional(),
});

authRouter.post(
  '/login',
  rateLimit({ windowSec: 60, max: 10, bucket: 'login' }),
  async (c) => {
    const input = LoginInput.parse(await c.req.json());
    const user = await db.query.users.findFirst({
      where: and(eq(schema.users.email, input.email), eq(schema.users.isActive, true)),
    });
    if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, input.password))) {
      throw new ProblemError(401, 'AUTH_INVALID', 'Invalid credentials.');
    }

    const memberships = await db.query.memberships.findMany({
      where: and(
        eq(schema.memberships.userId, user.id),
        eq(schema.memberships.isActive, true),
        isNull(schema.memberships.deletedAt),
      ),
    });
    if (memberships.length === 0) {
      throw new ProblemError(403, 'PERMISSION_DENIED', 'No tenant memberships.');
    }
    const targetTenantId =
      input.tenantId && memberships.find((m) => m.tenantId === input.tenantId)
        ? input.tenantId
        : memberships[0]!.tenantId;

    const sid = uuidv7();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS_WEB * 24 * 3600_000);
    await db.insert(schema.sessions).values({
      id: sid,
      userId: user.id,
      activeTenantId: targetTenantId,
      sessionType: 'web',
      expiresAt,
      ipAddress: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });

    setCookie(c, SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });
    await db.update(schema.users)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(schema.users.id, user.id));

    return c.json({
      session: { id: sid, expiresAt: expiresAt.toISOString() },
      user: { id: user.id, email: user.email, fullName: user.fullName },
      activeTenantId: targetTenantId,
      memberships: memberships.map((m) => ({ tenantId: m.tenantId, role: m.role })),
    });
  },
);

const PinLoginInput = z.object({
  pin: z.string().regex(/^\d{4}$/),
  outletId: z.string().uuid(),
});

authRouter.post(
  '/pin-login',
  rateLimit({ windowSec: 300, max: 5, bucket: 'pin-login' }),
  async (c) => {
    const input = PinLoginInput.parse(await c.req.json());

    // Terminal device must already be authenticated as an outlet — for MVP we resolve via outletId.
    const outlet = await db.query.outlets.findFirst({
      where: and(eq(schema.outlets.id, input.outletId), isNull(schema.outlets.deletedAt)),
    });
    if (!outlet) throw new ProblemError(404, 'NOT_FOUND', 'Outlet not found.');

    // Find any active kasir/manager membership in this tenant whose pin matches.
    const candidates = await db.query.memberships.findMany({
      where: and(
        eq(schema.memberships.tenantId, outlet.tenantId),
        eq(schema.memberships.isActive, true),
        isNull(schema.memberships.deletedAt),
      ),
      with: { /* drizzle relations TBD */ },
    });

    let matched: { userId: string; role: string } | null = null;
    for (const m of candidates) {
      const u = await db.query.users.findFirst({
        where: and(eq(schema.users.id, m.userId), eq(schema.users.isActive, true)),
      });
      if (!u?.pinHash) continue;
      if (await argon2.verify(u.pinHash, `${input.pin}:${u.id}`)) {
        matched = { userId: u.id, role: m.role };
        break;
      }
    }

    if (!matched) {
      // Track failed attempts per outlet+ip for lockout.
      const failKey = tenantKey(outlet.tenantId, 'pin-fail', outlet.id, c.req.header('x-forwarded-for') ?? 'anon');
      const fails = await redis.incr(failKey);
      if (fails === 1) await redis.expire(failKey, 300);
      if (fails > 5) {
        throw new ProblemError(429, 'RATE_LIMITED', 'Too many wrong PIN attempts. Try again in 5 minutes.');
      }
      throw new ProblemError(401, 'AUTH_INVALID', 'PIN incorrect.');
    }

    const sid = uuidv7();
    const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS_TERMINAL * 24 * 3600_000);
    await db.insert(schema.sessions).values({
      id: sid,
      userId: matched.userId,
      activeTenantId: outlet.tenantId,
      outletId: outlet.id,
      sessionType: 'terminal',
      expiresAt,
    });

    setCookie(c, SESSION_COOKIE, sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      expires: expiresAt,
    });

    return c.json({
      session: { id: sid, expiresAt: expiresAt.toISOString() },
      activeTenantId: outlet.tenantId,
      outletId: outlet.id,
      role: matched.role,
    });
  },
);

authRouter.post('/logout', authRequired, async (c) => {
  const id = c.get('identity');
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id.sessionId));
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRouter.get('/me', authRequired, async (c) => {
  const id = c.get('identity');
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, id.userId),
  });
  return c.json({
    user: user ? { id: user.id, email: user.email, fullName: user.fullName } : null,
    tenantId: id.tenantId,
    outletId: id.outletId,
    role: id.role,
    permissions: [...id.permissions],
  });
});
