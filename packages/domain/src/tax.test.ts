import { describe, expect, it } from 'vitest';
import { fromRupiah } from './money.js';
import { computeTax, quickTotal } from './tax.js';

describe('tax', () => {
  it('simple PKP: PPN 11% on Rp50.000, no discount, no service charge', () => {
    const r = quickTotal({
      subtotal: fromRupiah(50_000),
      discount: BigInt(0),
      serviceChargeBps: 0,
      ppnBps: 1100,
      tenantIsPkp: true,
    });
    expect(r.subtotal).toBe(fromRupiah(50_000));
    expect(r.serviceCharge).toBe(BigInt(0));
    expect(r.ppnTotal).toBe(fromRupiah(5_500));
    expect(r.total).toBe(fromRupiah(55_500));
  });

  it('non-PKP: no PPN charged', () => {
    const r = quickTotal({
      subtotal: fromRupiah(50_000),
      discount: BigInt(0),
      serviceChargeBps: 0,
      ppnBps: 1100,
      tenantIsPkp: false,
    });
    expect(r.ppnTotal).toBe(BigInt(0));
    expect(r.total).toBe(fromRupiah(50_000));
  });

  it('with 5% service charge: PPN base includes service', () => {
    // subtotal Rp100.000, service 5% = Rp5.000, PPN base Rp105.000, PPN 11% = Rp11.550
    const r = quickTotal({
      subtotal: fromRupiah(100_000),
      discount: BigInt(0),
      serviceChargeBps: 500,
      ppnBps: 1100,
      tenantIsPkp: true,
    });
    expect(r.serviceCharge).toBe(fromRupiah(5_000));
    expect(r.ppnTotal).toBe(fromRupiah(11_550));
    expect(r.total).toBe(fromRupiah(116_550));
  });

  it('order-level discount applied before service + PPN', () => {
    // subtotal Rp100.000, discount Rp20.000, base Rp80.000
    // service 5% = Rp4.000, PPN base Rp84.000, PPN 11% = Rp9.240
    const r = quickTotal({
      subtotal: fromRupiah(100_000),
      discount: fromRupiah(20_000),
      serviceChargeBps: 500,
      ppnBps: 1100,
      tenantIsPkp: true,
    });
    expect(r.discountedSubtotal).toBe(fromRupiah(80_000));
    expect(r.serviceCharge).toBe(fromRupiah(4_000));
    expect(r.ppnTotal).toBe(fromRupiah(9_240));
    expect(r.total).toBe(fromRupiah(93_240));
  });

  it('discount cannot exceed subtotal', () => {
    const r = quickTotal({
      subtotal: fromRupiah(50_000),
      discount: fromRupiah(60_000),
      serviceChargeBps: 0,
      ppnBps: 1100,
      tenantIsPkp: true,
    });
    expect(r.discountTotal).toBe(fromRupiah(50_000));
    expect(r.discountedSubtotal).toBe(BigInt(0));
    expect(r.total).toBe(BigInt(0));
  });

  it('mixed PPN per line: pro-rates discount and service charge', () => {
    // line A Rp40.000 at 11%, line B Rp60.000 at 0% (e.g. resold bottled water)
    // discount Rp10.000 → A pays 4000 / B pays 6000 (proportional)
    // service 5% = (90.000 × 0.05) = 4500 → A: 1800, B: 2700
    // A base: 40000 - 4000 + 1800 = 37800 → PPN 11% = 4158
    // B base: 60000 - 6000 + 2700 = 56700 → PPN 0% = 0
    const r = computeTax({
      lines: [
        { lineSubtotal: fromRupiah(40_000), ppnBps: 1100 },
        { lineSubtotal: fromRupiah(60_000), ppnBps: 0 },
      ],
      orderDiscount: fromRupiah(10_000),
      serviceChargeBps: 500,
      tenantIsPkp: true,
      roundingUnit: BigInt(0),
    });
    expect(r.subtotal).toBe(fromRupiah(100_000));
    expect(r.discountedSubtotal).toBe(fromRupiah(90_000));
    expect(r.serviceCharge).toBe(fromRupiah(4_500));
    expect(r.ppnTotal).toBe(fromRupiah(4_158));
  });

  it('rounds up to nearest Rp100 when configured', () => {
    // total ends in odd sen → rounded up
    const r = quickTotal({
      subtotal: fromRupiah(33_333),
      discount: BigInt(0),
      serviceChargeBps: 0,
      ppnBps: 1100,
      tenantIsPkp: true,
      roundingUnit: BigInt(10_000), // round to nearest Rp100
    });
    // 33333 + 11% = 36999.63 → 36999.63 rounded up to nearest Rp100 = 37000
    // PPN of 33333: 33333 × 0.11 = 3666.63 sen-precision = bps result
    // We just assert total is exact multiple of Rp100
    expect(r.total % BigInt(10_000)).toBe(BigInt(0));
    expect(r.rounding).toBeGreaterThanOrEqual(BigInt(0));
  });
});
