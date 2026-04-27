/**
 * Billing & bundling discount.
 *
 * `computeMonthlyBill` is a pure function. AGENTS.md §6.4.
 * Discount tier is inferred by total subtotal, not feature count.
 */

import type { Feature, FeatureCode, TenantFeature } from '@desain/types';
import { HARD_DEPENDENCIES, PRICING_TIERS } from '@desain/types';
import { ZERO, bps, sum } from './money.js';
import type { Sen } from './money.js';

export type EnabledFeatureRef = {
  code: FeatureCode;
  /** Optional override. Falls back to catalog price. */
  priceOverride?: Sen;
};

export type BillingTier = {
  code: 'warung' | 'cafe' | 'multi_cabang' | 'chain';
  minSubtotal: Sen;
  discountBps: number;
};

export type BillResult = {
  lineItems: Array<{ code: FeatureCode; price: Sen }>;
  subtotal: Sen;
  tier: BillingTier;
  discountBps: number;
  discountAmount: Sen;
  total: Sen;
  /** Hard-dependency violations: feature was enabled but its dependency was not. */
  unmetDependencies: Array<{ feature: FeatureCode; missing: readonly FeatureCode[] }>;
};

export function computeMonthlyBill(
  catalog: readonly Feature[],
  enabled: readonly EnabledFeatureRef[],
  tiers: readonly BillingTier[] = PRICING_TIERS as readonly BillingTier[],
): BillResult {
  const catalogByCode = new Map(catalog.map((f) => [f.code, f]));
  const enabledCodes = new Set(enabled.map((e) => e.code));

  const lineItems = enabled.flatMap<{ code: FeatureCode; price: Sen }>((ref) => {
    const feature = catalogByCode.get(ref.code);
    if (!feature || !feature.isActive) return [];
    return [{ code: ref.code, price: ref.priceOverride ?? feature.monthlyPrice }];
  });

  const subtotal = sum(lineItems.map((l) => l.price));
  const tier = pickTier(subtotal, tiers);
  const discountAmount = bps(subtotal, tier.discountBps);
  const total = subtotal - discountAmount;

  const unmetDependencies: BillResult['unmetDependencies'] = [];
  for (const code of enabledCodes) {
    const deps = HARD_DEPENDENCIES[code] ?? [];
    const missing = deps.filter((d) => !enabledCodes.has(d));
    if (missing.length > 0) unmetDependencies.push({ feature: code, missing });
  }

  return {
    lineItems,
    subtotal,
    tier,
    discountBps: tier.discountBps,
    discountAmount,
    total,
    unmetDependencies,
  };
}

function pickTier(subtotal: Sen, tiers: readonly BillingTier[]): BillingTier {
  let best = tiers[0]!;
  for (const t of tiers) {
    if (subtotal >= t.minSubtotal && t.minSubtotal >= best.minSubtotal) best = t;
  }
  return best;
}

/** Project active feature codes for a tenant at a given instant. */
export function activeFeatureCodes(
  tenantFeatures: readonly TenantFeature[],
  now: Date = new Date(),
): Set<FeatureCode> {
  const codes = new Set<FeatureCode>();
  for (const tf of tenantFeatures) {
    if (!tf.enabled) continue;
    if (tf.expiresAt && new Date(tf.expiresAt) < now) continue;
    codes.add(tf.featureCode);
  }
  return codes;
}

/** Convenience: snapshot for a billing run. */
export function buildEnabledRefs(
  tenantFeatures: readonly TenantFeature[],
  now: Date = new Date(),
): EnabledFeatureRef[] {
  return [...activeFeatureCodes(tenantFeatures, now)].map((code) => ({ code }));
}

export const _internal = {
  pickTier,
  ZERO,
};
