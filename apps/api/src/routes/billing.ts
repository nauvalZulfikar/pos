import { eq, and, db, schema } from '@desain/db';
import { computeMonthlyBill } from '@desain/domain';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';
import type { Feature, FeatureCode } from '@desain/types';

export const billingRouter = new Hono<{ Variables: RequestVars }>();

billingRouter.use('*', authRequired, tenantContext);

billingRouter.get('/preview', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const catalogRows = await db.query.features.findMany({
    where: eq(schema.features.isActive, true),
  });
  const catalog: Feature[] = catalogRows.map((r) => ({
    code: r.code as FeatureCode,
    group: r.group as Feature['group'],
    displayName: r.displayName as Feature['displayName'],
    description: r.description as Feature['description'],
    monthlyPrice: r.monthlyPrice,
    dependsOn: r.dependsOn as FeatureCode[],
    isActive: r.isActive,
  }));

  const enabledRows = await db.query.tenantFeatures.findMany({
    where: and(
      eq(schema.tenantFeatures.tenantId, id.tenantId),
      eq(schema.tenantFeatures.enabled, true),
    ),
  });
  const enabled = enabledRows.map((r) => ({ code: r.featureCode as FeatureCode }));
  const bill = computeMonthlyBill(catalog, enabled);
  return c.json({
    ...bill,
    subtotal: bill.subtotal.toString(),
    discountAmount: bill.discountAmount.toString(),
    total: bill.total.toString(),
    lineItems: bill.lineItems.map((li) => ({ code: li.code, price: li.price.toString() })),
    tier: { ...bill.tier, minSubtotal: bill.tier.minSubtotal.toString() },
  });
});
