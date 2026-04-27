import { describe, expect, it } from 'vitest';
import {
  add,
  bps,
  divRoundHalfEven,
  formatIDR,
  fromRupiah,
  mul,
  roundTo,
  sub,
  sum,
  toRupiahNumber,
} from './money.js';

describe('money', () => {
  describe('fromRupiah', () => {
    it('converts integer rupiah to sen', () => {
      expect(fromRupiah(1)).toBe(BigInt(100));
      expect(fromRupiah(15_000)).toBe(BigInt(1_500_000));
    });

    it('handles 1-2 decimal strings', () => {
      expect(fromRupiah('15000.5')).toBe(BigInt(1_500_050));
      expect(fromRupiah('15000.55')).toBe(BigInt(1_500_055));
    });

    it('rejects garbage', () => {
      expect(() => fromRupiah('abc')).toThrow();
      expect(() => fromRupiah(Number.POSITIVE_INFINITY)).toThrow();
    });

    it('handles negative', () => {
      expect(fromRupiah('-50.25')).toBe(BigInt(-5_025));
    });
  });

  it('add/sub round-trips', () => {
    expect(add(fromRupiah(15_000), fromRupiah(2_500))).toBe(fromRupiah(17_500));
    expect(sub(fromRupiah(20_000), fromRupiah(7_500))).toBe(fromRupiah(12_500));
  });

  it('mul accepts int and bigint', () => {
    expect(mul(fromRupiah(15_000), 3)).toBe(fromRupiah(45_000));
    expect(mul(fromRupiah(15_000), BigInt(3))).toBe(fromRupiah(45_000));
  });

  describe('bps', () => {
    it('11% PPN of Rp10.000 = Rp1.100', () => {
      expect(bps(fromRupiah(10_000), 1100)).toBe(fromRupiah(1_100));
    });
    it('rounds half-to-even', () => {
      // Rp1 × 11% = 0.11 sen → 0
      expect(bps(BigInt(100), 1100)).toBe(BigInt(11));
      // Rp0.005 × 100% = 0.5 sen → 0 (even)
      expect(bps(BigInt(1), 5000)).toBe(BigInt(0));
    });
  });

  describe('divRoundHalfEven', () => {
    it('rounds 0.5 down to even', () => {
      expect(divRoundHalfEven(BigInt(5), BigInt(10))).toBe(BigInt(0));
      expect(divRoundHalfEven(BigInt(15), BigInt(10))).toBe(BigInt(2));
      expect(divRoundHalfEven(BigInt(25), BigInt(10))).toBe(BigInt(2));
      expect(divRoundHalfEven(BigInt(35), BigInt(10))).toBe(BigInt(4));
    });
    it('rounds non-half normally', () => {
      expect(divRoundHalfEven(BigInt(7), BigInt(10))).toBe(BigInt(1));
      expect(divRoundHalfEven(BigInt(2), BigInt(10))).toBe(BigInt(0));
    });
    it('handles negatives', () => {
      expect(divRoundHalfEven(BigInt(-5), BigInt(10))).toBe(BigInt(0));
      expect(divRoundHalfEven(BigInt(-15), BigInt(10))).toBe(BigInt(-2));
    });
  });

  it('roundTo rounds to nearest unit', () => {
    expect(roundTo(fromRupiah(15_273), BigInt(100))).toBe(fromRupiah(15_273));
    expect(roundTo(fromRupiah(15_273.5), BigInt(100))).toBe(fromRupiah(15_274));
    // round to nearest Rp100 (= 10000 sen)
    expect(roundTo(fromRupiah(15_249), BigInt(10_000))).toBe(fromRupiah(15_200));
    expect(roundTo(fromRupiah(15_251), BigInt(10_000))).toBe(fromRupiah(15_300));
  });

  it('sum aggregates', () => {
    expect(sum([fromRupiah(1_000), fromRupiah(2_500), fromRupiah(3_000)])).toBe(fromRupiah(6_500));
    expect(sum([])).toBe(BigInt(0));
  });

  it('formatIDR matches Indonesian convention', () => {
    expect(formatIDR(fromRupiah(15_000))).toBe('Rp 15.000');
    expect(formatIDR(fromRupiah(1_234_567))).toBe('Rp 1.234.567');
    expect(formatIDR(fromRupiah(15_000.5))).toBe('Rp 15.000,50');
    expect(formatIDR(fromRupiah('-50000'))).toBe('-Rp 50.000');
  });

  it('toRupiahNumber round-trips small amounts', () => {
    expect(toRupiahNumber(fromRupiah(15_000))).toBe(15_000);
    expect(toRupiahNumber(fromRupiah(15_000.5))).toBe(15_000.5);
  });
});
