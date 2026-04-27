import { describe, expect, it } from 'vitest';
import { businessDayFor, jakartaIsoDate } from './time.js';

describe('time', () => {
  it('businessDayFor: 03:00 Jakarta on May 5 belongs to May 4 business day (boundary 04:00)', () => {
    // 2026-05-05 03:00 Asia/Jakarta == 2026-05-04 20:00 UTC
    const at = new Date('2026-05-04T20:00:00Z');
    const bd = businessDayFor(at, { boundary: '04:00' });
    expect(bd.isoDate).toBe('2026-05-04');
  });

  it('businessDayFor: 05:00 Jakarta on May 5 belongs to May 5 business day', () => {
    const at = new Date('2026-05-04T22:00:00Z'); // 05:00 Jakarta
    const bd = businessDayFor(at, { boundary: '04:00' });
    expect(bd.isoDate).toBe('2026-05-05');
  });

  it('businessDayFor: midnight UTC behaves correctly', () => {
    const at = new Date('2026-05-05T00:00:00Z'); // 07:00 Jakarta
    const bd = businessDayFor(at, { boundary: '04:00' });
    expect(bd.isoDate).toBe('2026-05-05');
  });

  it('businessDayFor: rejects malformed boundary', () => {
    expect(() => businessDayFor(new Date(), { boundary: '24:00' })).toThrow();
    expect(() => businessDayFor(new Date(), { boundary: 'oops' })).toThrow();
  });

  it('businessDayFor: endUtc is exactly 24h after startUtc', () => {
    const bd = businessDayFor(new Date('2026-05-05T12:00:00Z'), { boundary: '04:00' });
    expect(bd.endUtc.getTime() - bd.startUtc.getTime()).toBe(24 * 3600 * 1000);
  });

  it('jakartaIsoDate produces YYYY-MM-DD', () => {
    const result = jakartaIsoDate(new Date('2026-05-05T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result).toBe('2026-05-05');
  });
});
