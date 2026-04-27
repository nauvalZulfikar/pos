import { describe, expect, it } from 'vitest';
import {
  FeatureCode,
  FeatureGroup,
  HARD_DEPENDENCIES,
  PRICING_TIERS,
} from './feature.js';

describe('feature catalog invariants', () => {
  it('every feature in HARD_DEPENDENCIES references valid codes', () => {
    const validCodes = new Set(FeatureCode.options);
    for (const [code, deps] of Object.entries(HARD_DEPENDENCIES)) {
      expect(validCodes.has(code as FeatureCode)).toBe(true);
      for (const d of deps ?? []) {
        expect(validCodes.has(d)).toBe(true);
      }
    }
  });

  it('PRICING_TIERS is in ascending order by minSubtotal', () => {
    for (let i = 1; i < PRICING_TIERS.length; i++) {
      expect(PRICING_TIERS[i]!.minSubtotal).toBeGreaterThanOrEqual(
        PRICING_TIERS[i - 1]!.minSubtotal,
      );
    }
  });

  it('PRICING_TIERS first entry has 0 minSubtotal (warung)', () => {
    expect(PRICING_TIERS[0]!.minSubtotal).toBe(BigInt(0));
    expect(PRICING_TIERS[0]!.code).toBe('warung');
  });

  it('FeatureGroup options are all known', () => {
    for (const g of FeatureGroup.options) {
      expect(typeof g).toBe('string');
    }
  });

  it('no feature depends on itself', () => {
    for (const [code, deps] of Object.entries(HARD_DEPENDENCIES)) {
      expect(deps?.includes(code as FeatureCode)).toBe(false);
    }
  });
});
