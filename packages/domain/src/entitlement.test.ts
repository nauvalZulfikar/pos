import { describe, expect, it } from 'vitest';
import { FeatureNotEnabledError } from '@desain/types';
import {
  buildFeatureMap,
  hasFeature,
  requireAllFeatures,
  requireAnyFeature,
  requireFeature,
} from './entitlement.js';

const ctx = (codes: string[]) => ({ features: buildFeatureMap(codes as never) });

describe('entitlement', () => {
  it('hasFeature returns true only for enabled codes', () => {
    const c = ctx(['qris_native']);
    expect(hasFeature(c, 'qris_native' as never)).toBe(true);
    expect(hasFeature(c, 'gofood_integration' as never)).toBe(false);
  });

  it('requireFeature throws FeatureNotEnabledError when missing', () => {
    expect(() => requireFeature(ctx([]), 'qris_native' as never)).toThrowError(FeatureNotEnabledError);
  });

  it('requireFeature passes when enabled', () => {
    expect(() => requireFeature(ctx(['qris_native']), 'qris_native' as never)).not.toThrow();
  });

  it('requireAnyFeature passes if at least one is enabled', () => {
    expect(() =>
      requireAnyFeature(ctx(['gofood_integration']), [
        'gofood_integration',
        'grabfood_integration',
      ] as never[]),
    ).not.toThrow();
  });

  it('requireAnyFeature throws if none are enabled', () => {
    expect(() =>
      requireAnyFeature(ctx([]), ['gofood_integration', 'grabfood_integration'] as never[]),
    ).toThrow(FeatureNotEnabledError);
  });

  it('requireAllFeatures throws if any is missing', () => {
    expect(() =>
      requireAllFeatures(ctx(['gofood_integration']), [
        'gofood_integration',
        'grabfood_integration',
      ] as never[]),
    ).toThrow(FeatureNotEnabledError);
  });

  it('requireAllFeatures passes when all are enabled', () => {
    expect(() =>
      requireAllFeatures(
        ctx(['gofood_integration', 'grabfood_integration']),
        ['gofood_integration', 'grabfood_integration'] as never[],
      ),
    ).not.toThrow();
  });

  it('FeatureNotEnabledError carries the code in extra payload', () => {
    try {
      requireFeature(ctx([]), 'qris_native' as never);
      expect.fail('should have thrown');
    } catch (err) {
      if (!(err instanceof FeatureNotEnabledError)) throw err;
      expect(err.status).toBe(403);
      expect(err.code).toBe('FEATURE_NOT_ENABLED');
      expect(err.extra.feature).toBe('qris_native');
    }
  });
});
