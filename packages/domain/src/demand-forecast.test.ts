import { describe, expect, it } from 'vitest';
import {
  bucketize,
  forecast,
  isHoliday2026,
  ID_HOLIDAYS_2026,
} from './demand-forecast.js';

describe('bucketize', () => {
  it('groups samples by day-of-week', () => {
    const buckets = bucketize([
      { dow: 1, qty: 10 },
      { dow: 1, qty: 20 },
      { dow: 2, qty: 5 },
    ]);
    expect(buckets.get(1)).toEqual({ sum: 30, sumSq: 500, n: 2 });
    expect(buckets.get(2)).toEqual({ sum: 5, sumSq: 25, n: 1 });
    expect(buckets.has(0)).toBe(false);
  });

  it('empty input → empty map', () => {
    expect(bucketize([]).size).toBe(0);
  });
});

describe('forecast', () => {
  it('returns null when bucket is empty', () => {
    expect(forecast(undefined, { dow: 1 })).toBeNull();
  });

  it('returns mean ± stddev for a populated bucket', () => {
    const bucket = bucketize([
      { dow: 1, qty: 10 },
      { dow: 1, qty: 12 },
      { dow: 1, qty: 14 },
      { dow: 1, qty: 16 },
    ]).get(1)!;
    const r = forecast(bucket, { dow: 1 });
    expect(r).not.toBeNull();
    expect(r!.expectedQty).toBe(13); // mean
    expect(r!.lowerQty).toBeLessThanOrEqual(13);
    expect(r!.upperQty).toBeGreaterThanOrEqual(13);
    expect(r!.sampleDays).toBe(4);
    expect(r!.method).toBe('seasonal_naive');
  });

  it('applies holiday boost when isHoliday=true', () => {
    const bucket = bucketize([
      { dow: 0, qty: 100 },
      { dow: 0, qty: 100 },
      { dow: 0, qty: 100 },
    ]).get(0)!;
    const normal = forecast(bucket, { dow: 0 });
    const holiday = forecast(bucket, { dow: 0, isHoliday: true });
    expect(normal!.expectedQty).toBe(100);
    expect(holiday!.expectedQty).toBe(120); // +20% default
    expect(holiday!.method).toBe('seasonal_naive_holiday');
  });

  it('respects custom holiday boost', () => {
    const bucket = bucketize([{ dow: 0, qty: 100 }]).get(0)!;
    const r = forecast(bucket, { dow: 0, isHoliday: true, holidayBoost: 1.5 });
    expect(r!.expectedQty).toBe(150);
  });

  it('clamps lowerQty to 0 (no negative orders)', () => {
    const bucket = bucketize([
      { dow: 0, qty: 5 },
      { dow: 0, qty: 5 },
      { dow: 0, qty: 50 }, // huge variance → mean−sd may be negative
    ]).get(0)!;
    const r = forecast(bucket, { dow: 0 });
    expect(r!.lowerQty).toBeGreaterThanOrEqual(0);
  });
});

describe('Indonesian 2026 holidays', () => {
  it('flags HUT RI', () => {
    expect(isHoliday2026('2026-08-17')).toBe(true);
  });

  it('flags Natal', () => {
    expect(isHoliday2026('2026-12-25')).toBe(true);
  });

  it('non-holiday returns false', () => {
    expect(isHoliday2026('2026-07-01')).toBe(false);
    expect(isHoliday2026('2026-08-18')).toBe(false);
  });

  it('exposes the holiday set', () => {
    expect(ID_HOLIDAYS_2026.size).toBeGreaterThanOrEqual(10);
  });
});
