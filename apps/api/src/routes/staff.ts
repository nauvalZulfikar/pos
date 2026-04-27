import argon2 from 'argon2';
import { and, db, eq, isNull, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const staffRouter = new Hono<{ Variables: RequestVars }>();

staffRouter.use('*', authRequired, tenantContext);

staffRouter.get('/', requirePermission('staff:manage'), async (c) => {
  const id = c.get('identity');
  const memberships = await db.query.memberships.findMany({
    where: and(
      eq(schema.memberships.tenantId, id.tenantId),
      isNull(schema.memberships.deletedAt),
    ),
  });
  const userIds = memberships.map((m) => m.userId);
  const users = userIds.length === 0
    ? []
    : await db.query.users.findMany({
        where: eq(schema.users.id, userIds[0]!), // first user; we'll batch below
      }).then(async () => {
        // batch fetch — simpler than IN with single id
        const all = [];
        for (const uid of userIds) {
          const u = await db.query.users.findFirst({ where: eq(schema.users.id, uid) });
          if (u) all.push(u);
        }
        return all;
      });

  const userById = new Map(users.map((u) => [u.id, u]));
  return c.json({
    items: memberships.map((m) => ({
      membership: {
        id: m.id,
        role: m.role,
        outletPermissions: m.outletPermissions,
        isActive: m.isActive,
      },
      user: userById.get(m.userId)
        ? {
            id: m.userId,
            email: userById.get(m.userId)!.email,
            fullName: userById.get(m.userId)!.fullName,
            phone: userById.get(m.userId)!.phone,
            hasPin: !!userById.get(m.userId)!.pinHash,
            isActive: userById.get(m.userId)!.isActive,
          }
        : null,
    })),
  });
});

const InviteStaffInput = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  phone: z.string().regex(/^\+?\d{8,15}$/).nullable().optional(),
  role: z.enum(['owner', 'manager', 'kasir', 'dapur']),
  pin: z.string().regex(/^\d{4}$/).nullable().optional(),
  password: z.string().min(8).max(72).nullable().optional(),
});

staffRouter.post('/invite', requirePermission('staff:manage'), async (c) => {
  const id = c.get('identity');
  const input = InviteStaffInput.parse(await c.req.json());

  // Find or create user
  let user = await db.query.users.findFirst({ where: eq(schema.users.email, input.email) });
  if (!user) {
    const newUserId = uuidv7();
    const passwordHash = input.password ? await argon2.hash(input.password) : null;
    const pinHash = input.pin ? await argon2.hash(`${input.pin}:${newUserId}`) : null;
    await db.insert(schema.users).values({
      id: newUserId,
      email: input.email,
      fullName: input.fullName,
      phone: input.phone ?? null,
      passwordHash,
      pinHash,
      isActive: true,
    });
    user = await db.query.users.findFirst({ where: eq(schema.users.id, newUserId) });
  } else if (input.pin || input.password) {
    // Update credentials if requested
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.password) patch.passwordHash = await argon2.hash(input.password);
    if (input.pin) patch.pinHash = await argon2.hash(`${input.pin}:${user.id}`);
    await db.update(schema.users).set(patch).where(eq(schema.users.id, user.id));
  }

  if (!user) throw new ProblemError(500, 'INTERNAL', 'User creation failed');

  // Create or activate membership
  const existingMembership = await db.query.memberships.findFirst({
    where: and(
      eq(schema.memberships.tenantId, id.tenantId),
      eq(schema.memberships.userId, user.id),
    ),
  });
  if (existingMembership) {
    await db
      .update(schema.memberships)
      .set({ role: input.role, isActive: true, deletedAt: null, updatedAt: new Date() })
      .where(eq(schema.memberships.id, existingMembership.id));
  } else {
    await db.insert(schema.memberships).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      userId: user.id,
      role: input.role,
      outletPermissions: [],
      isActive: true,
    });
  }

  return c.json({ user: { id: user.id, email: user.email, fullName: user.fullName } }, 201);
});

const SetPinInput = z.object({ pin: z.string().regex(/^\d{4}$/) });

staffRouter.post('/:userId/pin', requirePermission('staff:manage'), async (c) => {
  const userId = c.req.param('userId');
  const input = SetPinInput.parse(await c.req.json());
  const pinHash = await argon2.hash(`${input.pin}:${userId}`);
  await db
    .update(schema.users)
    .set({ pinHash, updatedAt: new Date() })
    .where(eq(schema.users.id, userId));
  return c.json({ ok: true });
});

const UpdateMembershipInput = z.object({
  role: z.enum(['owner', 'manager', 'kasir', 'dapur']).optional(),
  isActive: z.boolean().optional(),
  outletPermissions: z
    .array(
      z.object({
        outletId: z.string().uuid(),
        permissions: z.array(z.string()),
      }),
    )
    .optional(),
});

staffRouter.patch('/:userId', requirePermission('staff:manage'), async (c) => {
  const id = c.get('identity');
  const userId = c.req.param('userId');
  const input = UpdateMembershipInput.parse(await c.req.json());
  await db
    .update(schema.memberships)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(schema.memberships.tenantId, id.tenantId),
        eq(schema.memberships.userId, userId),
      ),
    );
  return c.json({ ok: true });
});

staffRouter.delete('/:userId', requirePermission('staff:manage'), async (c) => {
  const id = c.get('identity');
  const userId = c.req.param('userId');
  await db
    .update(schema.memberships)
    .set({ isActive: false, deletedAt: new Date() })
    .where(
      and(
        eq(schema.memberships.tenantId, id.tenantId),
        eq(schema.memberships.userId, userId),
      ),
    );
  return c.json({ ok: true });
});
