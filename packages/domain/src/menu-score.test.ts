import { describe, expect, it } from 'vitest';
import { classify, median, medianBig, rationaleFor } from './menu-score.js';

describe('menu-score classifier', () => {
  it('high qty + high margin → bintang', () => {
    expect(
      classify({ qty: 100, margin: BigInt(500_000), qtyCutoff: 50, marginCutoff: BigInt(100_000) }),
    ).toBe('bintang');
  });

  it('high qty + low margin → sapi_perah', () => {
    expect(
      classify({ qty: 100, margin: BigInt(50_000), qtyCutoff: 50, marginCutoff: BigInt(100_000) }),
    ).toBe('sapi_perah');
  });

  it('low qty + high margin → tanda_tanya', () => {
    expect(
      classify({ qty: 20, margin: BigInt(500_000), qtyCutoff: 50, marginCutoff: BigInt(100_000) }),
    ).toBe('tanda_tanya');
  });

  it('low qty + low margin → anjing', () => {
    expect(
      classify({ qty: 20, margin: BigInt(50_000), qtyCutoff: 50, marginCutoff: BigInt(100_000) }),
    ).toBe('anjing');
  });

  it('exactly at cutoffs counts as high (>=)', () => {
    expect(
      classify({ qty: 50, margin: BigInt(100_000), qtyCutoff: 50, marginCutoff: BigInt(100_000) }),
    ).toBe('bintang');
  });

  it('handles negative margin (loss-making item)', () => {
    expect(
      classify({ qty: 100, margin: BigInt(-50_000), qtyCutoff: 50, marginCutoff: BigInt(0) }),
    ).toBe('sapi_perah');
  });
});

describe('median helpers', () => {
  it('median of empty array is 0', () => {
    expect(median([])).toBe(0);
  });

  it('median of odd-length array picks middle', () => {
    expect(median([1, 5, 3])).toBe(3);
  });

  it('median of even-length array averages two middles (floored)', () => {
    expect(median([1, 2, 3, 4])).toBe(2); // (2+3)/2 = 2.5 → floor = 2
  });

  it('medianBig works with bigints', () => {
    expect(medianBig([BigInt(1), BigInt(5), BigInt(3)])).toBe(BigInt(3));
    expect(medianBig([BigInt(1), BigInt(2), BigInt(3), BigInt(4)])).toBe(BigInt(2));
  });

  it('medianBig of empty array is 0n', () => {
    expect(medianBig([])).toBe(BigInt(0));
  });
});

describe('rationaleFor', () => {
  it('produces Indonesian recommendation per category', () => {
    expect(rationaleFor('bintang', 'Nasi Goreng')).toContain('pertahankan');
    expect(rationaleFor('sapi_perah', 'Es Teh')).toContain('naikkan harga');
    expect(rationaleFor('tanda_tanya', 'Salad')).toContain('promosi');
    expect(rationaleFor('anjing', 'Sayur Asem')).toContain('dihapus');
  });
});
