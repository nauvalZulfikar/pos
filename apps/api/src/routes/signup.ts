/**
 * Public tenant signup. Creates: tenant + first outlet + first owner user + membership + default features.
 * No auth required. AGENTS.md §28.1 — onboarding-friendly.
 */

import argon2 from 'argon2';
import { db, schema, sql, eq } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import type { RequestVars } from '../context.js';

export const signupRouter = new Hono<{ Variables: RequestVars }>();

const SignupInput = z.object({
  // Tenant
  legalName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(120),
  segment: z.enum(['warung', 'cafe', 'multi_cabang', 'chain']),
  isPkp: z.boolean().default(false),
  npwp: z.string().regex(/^\d{15,16}$/).nullable().optional(),
  // Owner
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  ownerPhone: z.string().regex(/^\+?\d{8,15}$/).nullable().optional(),
  password: z.string().min(8).max(72),
  // First outlet
  outletName: z.string().min(1).max(120),
  outletCode: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  outletAddress: z.string().min(1).max(200),
  outletCity: z.string().max(80),
  outletProvince: z.string().max(80),
});

const DEFAULT_ENABLED_FEATURES = [
  'core_pos',
  'core_admin',
  'core_reports',
  'core_audit',
  'shift_cash_drawer',
  'qris_native',
  'table_management',
] as const;

signupRouter.post('/', async (c) => {
  const input = SignupInput.parse(await c.req.json());

  // Check email not taken
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, input.ownerEmail),
  });
  if (existing) {
    throw new ProblemError(409, 'CONFLICT', 'Email sudah terdaftar. Silakan login.');
  }

  const tenantId = uuidv7();
  const outletId = uuidv7();
  const userId = uuidv7();
  const sessionId = uuidv7();

  const passwordHash = await argon2.hash(input.password);

  await db.transaction(async (tx) => {
    await tx.insert(schema.tenants).values({
      id: tenantId,
      legalName: input.legalName,
      displayName: input.displayName,
      segment: input.segment,
      isPkp: input.isPkp,
      npwp: input.npwp ?? null,
      defaultLocale: 'id-ID',
      defaultTimezone: 'Asia/Jakarta',
      businessDayBoundary: '04:00',
      status: 'active',
    });

    // Set RLS for follow-on tenant-scoped inserts
    await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
    await tx.execute(sql`select set_config('app.current_user_id', ${userId}, true)`);

    await tx.insert(schema.outlets).values({
      id: outletId,
      tenantId,
      name: input.outletName,
      code: input.outletCode,
      addressLine1: input.outletAddress,
      city: input.outletCity,
      province: input.outletProvince,
      isActive: true,
    });

    await tx.insert(schema.users).values({
      id: userId,
      email: input.ownerEmail,
      fullName: input.ownerName,
      phone: input.ownerPhone ?? null,
      passwordHash,
      pinHash: null,
      isActive: true,
    });

    await tx.insert(schema.memberships).values({
      id: uuidv7(),
      tenantId,
      userId,
      role: 'owner',
      outletPermissions: [],
      isActive: true,
    });

    for (const code of DEFAULT_ENABLED_FEATURES) {
      await tx.insert(schema.tenantFeatures).values({
        tenantId,
        featureCode: code,
        enabled: true,
        source: 'trial',
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);
    await tx.insert(schema.sessions).values({
      id: sessionId,
      userId,
      activeTenantId: tenantId,
      sessionType: 'web',
      expiresAt,
      ipAddress: c.req.header('x-forwarded-for') ?? null,
      userAgent: c.req.header('user-agent') ?? null,
    });
  });

  const expiresAt = new Date(Date.now() + 30 * 24 * 3600_000);
  setCookie(c, 'desain_sid', sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });

  return c.json({
    tenant: { id: tenantId, displayName: input.displayName },
    outlet: { id: outletId, code: input.outletCode },
    user: { id: userId, email: input.ownerEmail, fullName: input.ownerName },
    session: { id: sessionId, expiresAt: expiresAt.toISOString() },
  }, 201);
});
