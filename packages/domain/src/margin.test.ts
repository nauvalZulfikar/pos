import { describe, expect, it } from 'vitest';
import { fromRupiah } from './money.js';
import { computeMargin } from './margin.js';

describe('margin', () => {
  it('20% commission on Rp50.000 with Rp20.000 cost: net Rp40k, margin Rp20k = 50%', () => {
    const r = computeMargin({
      menuPrice: fromRupiah(50_000),
      recipeCost: fromRupiah(20_000),
      commissionBps: 2000,
    });
    expect(r.commissionAmount).toBe(fromRupiah(10_000));
    expect(r.netReceived).toBe(fromRupiah(40_000));
    expect(r.marginAmount).toBe(fromRupiah(20_000));
    expect(r.marginBps).toBe(5000);
  });

  it('zero commission: margin = price - cost', () => {
    const r = computeMargin({
      menuPrice: fromRupiah(30_000),
      recipeCost: fromRupiah(10_000),
      commissionBps: 0,
    });
    expect(r.commissionAmount).toBe(BigInt(0));
    expect(r.netReceived).toBe(fromRupiah(30_000));
    expect(r.marginAmount).toBe(fromRupiah(20_000));
  });

  it('negative margin when cost exceeds net', () => {
    const r = computeMargin({
      menuPrice: fromRupiah(30_000),
      recipeCost: fromRupiah(28_000),
      commissionBps: 2000, // -> net 24k, margin -4k
    });
    expect(r.netReceived).toBe(fromRupiah(24_000));
    expect(r.marginAmount).toBe(fromRupiah(-4_000));
    expect(r.marginBps).toBeLessThan(0);
  });

  it('zero net guards against div-by-zero in marginBps', () => {
    const r = computeMargin({
      menuPrice: BigInt(0),
      recipeCost: BigInt(0),
      commissionBps: 0,
    });
    expect(r.marginBps).toBe(0);
  });
});
