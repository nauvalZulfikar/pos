import { describe, expect, it } from 'vitest';
import type { Feature, FeatureCode } from '@desain/types';
import { fromRupiah } from './money.js';
import { computeMonthlyBill } from './billing.js';

const f = (code: FeatureCode, price: number, group: Feature['group'] = 'core'): Feature => ({
  code,
  group,
  displayName: { 'id-ID': code, 'en-US': code },
  description: { 'id-ID': '', 'en-US': '' },
  monthlyPrice: fromRupiah(price),
  dependsOn: [],
  isActive: true,
});

describe('computeMonthlyBill', () => {
  const catalog: Feature[] = [
    f('core_pos', 99_000, 'core'),
    f('qris_native', 49_000, 'payment'),
    f('ewallet_aggregator', 39_000, 'payment'),
    f('gofood_integration', 79_000, 'delivery'),
    f('multi_outlet_dashboard', 99_000, 'multi_outlet'),
    f('inventory_recipe', 79_000, 'inventory'),
    f('multi_outlet_inventory', 59_000, 'multi_outlet'),
    f('ai_daily_brief', 99_000, 'ai'),
    f('core_reports', 0, 'core'),
  ];

  it('warung tier: small subtotal, no discount', () => {
    const r = computeMonthlyBill(catalog, [{ code: 'core_pos' }, { code: 'qris_native' }]);
    expect(r.subtotal).toBe(fromRupiah(148_000));
    expect(r.tier.code).toBe('warung');
    expect(r.discountBps).toBe(0);
    expect(r.total).toBe(fromRupiah(148_000));
  });

  it('cafe tier @ Rp150k threshold: 10%', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos' },
      { code: 'qris_native' },
      { code: 'ewallet_aggregator' },
    ]);
    expect(r.subtotal).toBe(fromRupiah(187_000));
    expect(r.tier.code).toBe('cafe');
    expect(r.discountBps).toBe(1000);
    expect(r.discountAmount).toBe(fromRupiah(18_700));
    expect(r.total).toBe(fromRupiah(168_300));
  });

  it('multi_cabang tier @ Rp400k threshold: 20%', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos' },
      { code: 'qris_native' },
      { code: 'ewallet_aggregator' },
      { code: 'gofood_integration' },
      { code: 'multi_outlet_dashboard' },
      { code: 'inventory_recipe' },
    ]);
    // 99 + 49 + 39 + 79 + 99 + 79 = 444 → ≥ 400k → 20%
    expect(r.subtotal).toBe(fromRupiah(444_000));
    expect(r.tier.code).toBe('multi_cabang');
    expect(r.discountBps).toBe(2000);
    expect(r.total).toBe(fromRupiah(355_200));
  });

  it('detects unmet hard dependencies', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos' },
      { code: 'ewallet_aggregator' }, // depends on qris_native — missing
    ]);
    expect(r.unmetDependencies).toHaveLength(1);
    expect(r.unmetDependencies[0]!.feature).toBe('ewallet_aggregator');
    expect(r.unmetDependencies[0]!.missing).toContain('qris_native');
  });

  it('no unmet dependencies when all satisfied', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos' },
      { code: 'qris_native' },
      { code: 'ewallet_aggregator' },
      { code: 'multi_outlet_dashboard' },
      { code: 'inventory_recipe' },
      { code: 'multi_outlet_inventory' }, // depends on both above
    ]);
    expect(r.unmetDependencies).toHaveLength(0);
  });

  it('uses price override when provided', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos', priceOverride: fromRupiah(50_000) },
    ]);
    expect(r.subtotal).toBe(fromRupiah(50_000));
  });

  it('drops inactive or unknown features silently', () => {
    const r = computeMonthlyBill(catalog, [
      { code: 'core_pos' },
      { code: 'efaktur_b2b' as FeatureCode }, // not in catalog
    ]);
    expect(r.lineItems).toHaveLength(1);
  });
});
