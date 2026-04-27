/**
 * Entitlement guard — the single check every feature-gated route runs through.
 * AGENTS.md §6.3.
 */

import type { FeatureCode } from '@desain/types';
import { FeatureNotEnabledError } from '@desain/types';

export type FeatureMap = Record<FeatureCode, boolean>;

export type RequestContextFeatures = {
  features: FeatureMap;
};

export function hasFeature(ctx: RequestContextFeatures, code: FeatureCode): boolean {
  return Boolean(ctx.features[code]);
}

export function requireFeature(
  ctx: RequestContextFeatures,
  code: FeatureCode,
): asserts ctx is RequestContextFeatures {
  if (!hasFeature(ctx, code)) throw new FeatureNotEnabledError(code);
}

export function requireAnyFeature(
  ctx: RequestContextFeatures,
  codes: readonly FeatureCode[],
): void {
  if (codes.some((c) => hasFeature(ctx, c))) return;
  throw new FeatureNotEnabledError(codes.join(' | '));
}

export function requireAllFeatures(
  ctx: RequestContextFeatures,
  codes: readonly FeatureCode[],
): void {
  for (const c of codes) requireFeature(ctx, c);
}

/** Build a default-false feature map and toggle the enabled ones on. */
export function buildFeatureMap(enabled: readonly FeatureCode[]): FeatureMap {
  const map = {} as FeatureMap;
  for (const code of enabled) map[code] = true;
  return map;
}
