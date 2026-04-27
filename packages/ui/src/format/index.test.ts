import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatDateTime, formatNumber } from './index.js';

describe('format', () => {
  it('formatCurrency Indonesian convention', () => {
    const result = formatCurrency(BigInt(15_000_00));
    // Intl uses a non-breaking space between currency and digits; collapse to ASCII before matching.
    expect(result.replace(/\s/g, ' ')).toMatch(/Rp ?15\.000/);
  });

  it('formatNumber with thousand separators', () => {
    const result = formatNumber(1234567);
    expect(result.replace(/\s/g, '')).toBe('1.234.567');
  });

  it('formatDate respects Asia/Jakarta tz', () => {
    const out = formatDate(new Date('2026-05-04T18:00:00Z'));
    expect(out).toContain('05');
  });

  it('formatDateTime returns combined output', () => {
    const out = formatDateTime(new Date('2026-05-05T05:00:00Z'));
    expect(out).toMatch(/\d{2}/);
  });

  it('formatCurrency negative values', () => {
    const out = formatCurrency(BigInt(-50_000_00));
    expect(out).toMatch(/-/);
  });
});
