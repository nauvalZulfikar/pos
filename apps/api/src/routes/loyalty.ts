import { and, db, eq, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const loyaltyRouter = new Hono<{ Variables: RequestVars }>();

loyaltyRouter.use('*', authRequired, tenantContext, requireFeatures(['loyalty_points']));

loyaltyRouter.get('/account/:customerId', async (c) => {
  const id = c.get('identity');
  const customerId = c.req.param('customerId');
  const account = await db.query.loyaltyAccounts.findFirst({
    where: and(
      eq(schema.loyaltyAccounts.tenantId, id.tenantId),
      eq(schema.loyaltyAccounts.customerId, customerId),
    ),
  });
  if (!account) {
    return c.json({ account: null });
  }
  return c.json({ account });
});

const EarnInput = z.object({
  customerId: z.string().uuid(),
  orderId: z.string().uuid(),
  /** Order subtotal in sen — points formula is configurable per tenant. */
  subtotal: z.coerce.bigint(),
});

/**
 * Default earn rate: 1 point per Rp10.000 spent. Configurable later via tenant settings.
 */
const POINTS_PER_RUPIAH_BPS = 10; // 1 point per Rp1.000 in spend at 0.1% rate

const TIER_RANK: Record<string, number> = { regular: 0, silver: 1, gold: 2 };
function tierFromVisits(visits: number): 'regular' | 'silver' | 'gold' {
  if (visits >= 20) return 'gold';
  if (visits >= 5) return 'silver';
  return 'regular';
}

loyaltyRouter.post('/earn', requirePermission('payment:record'), async (c) => {
  const id = c.get('identity');
  const input = EarnInput.parse(await c.req.json());
  const points = (input.subtotal * BigInt(POINTS_PER_RUPIAH_BPS)) / BigInt(1_000_000);

  const customer = await db.query.customers.findFirst({
    where: and(
      eq(schema.customers.id, input.customerId),
      eq(schema.customers.tenantId, id.tenantId),
    ),
  });

  const newTier = tierFromVisits(customer?.visitCount ?? 0);

  const existing = await db.query.loyaltyAccounts.findFirst({
    where: and(
      eq(schema.loyaltyAccounts.tenantId, id.tenantId),
      eq(schema.loyaltyAccounts.customerId, input.customerId),
    ),
  });

  let upgraded = false;
  if (existing) {
    const currentRank = TIER_RANK[existing.tier] ?? 0;
    const newRank = TIER_RANK[newTier] ?? 0;
    const promoted = newRank > currentRank ? newTier : existing.tier;
    upgraded = promoted !== existing.tier;
    await db
      .update(schema.loyaltyAccounts)
      .set({
        pointsBalance: existing.pointsBalance + points,
        tier: promoted,
        updatedAt: new Date(),
      })
      .where(eq(schema.loyaltyAccounts.id, existing.id));
  } else {
    await db.insert(schema.loyaltyAccounts).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      customerId: input.customerId,
      pointsBalance: points,
      tier: newTier,
    });
    upgraded = newTier !== 'regular';
  }
  return c.json({ pointsEarned: points.toString(), tier: newTier, upgraded });
});

const RedeemInput = z.object({
  customerId: z.string().uuid(),
  pointsToRedeem: z.coerce.bigint().positive(),
  /** Conversion rate: 100 poin = Rp1.000 = 100.000 sen */
});

loyaltyRouter.post('/redeem', requirePermission('payment:record'), async (c) => {
  const id = c.get('identity');
  const input = RedeemInput.parse(await c.req.json());
  const account = await db.query.loyaltyAccounts.findFirst({
    where: and(
      eq(schema.loyaltyAccounts.tenantId, id.tenantId),
      eq(schema.loyaltyAccounts.customerId, input.customerId),
    ),
  });
  if (!account) throw new ProblemError(404, 'NOT_FOUND', 'Account not found');
  if (account.pointsBalance < input.pointsToRedeem) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Insufficient points');
  }

  const discountSen = input.pointsToRedeem * BigInt(1000); // 100 poin = Rp1.000 = 100.000 sen, so 1 poin = 1.000 sen

  await db
    .update(schema.loyaltyAccounts)
    .set({
      pointsBalance: account.pointsBalance - input.pointsToRedeem,
      updatedAt: new Date(),
    })
    .where(eq(schema.loyaltyAccounts.id, account.id));

  return c.json({ discountSen: discountSen.toString(), remainingPoints: (account.pointsBalance - input.pointsToRedeem).toString() });
});
