/**
 * Seasonal-naive demand forecasting helpers.
 *
 * The seasonal-naive method: for each future day, take the same day-of-week's
 * historical mean. Apply an Indonesian-holiday boost when the target day is a
 * national holiday. 80% confidence band = mean ± 1 standard deviation.
 */

export type Sample = { dow: number; qty: number };

export type Bucket = { sum: number; sumSq: number; n: number };

export type ForecastInput = {
  /** Target day-of-week (0 = Sun, 6 = Sat). */
  dow: number;
  /** Whether the target day is a national holiday in Indonesia. */
  isHoliday?: boolean;
  /** Holiday boost multiplier. Default 1.20 (+20%). */
  holidayBoost?: number;
};

export type ForecastResult = {
  expectedQty: number;
  lowerQty: number;
  upperQty: number;
  sampleDays: number;
  method: 'seasonal_naive' | 'seasonal_naive_holiday';
};

/** Group samples by dow into rolling-stat buckets. */
export function bucketize(samples: Sample[]): Map<number, Bucket> {
  const buckets = new Map<number, Bucket>();
  for (const s of samples) {
    const b = buckets.get(s.dow) ?? { sum: 0, sumSq: 0, n: 0 };
    b.sum += s.qty;
    b.sumSq += s.qty * s.qty;
    b.n += 1;
    buckets.set(s.dow, b);
  }
  return buckets;
}

/** Forecast the quantity for one (menu, future_day) pair. Returns null if no samples. */
export function forecast(
  bucket: Bucket | undefined,
  opts: ForecastInput,
): ForecastResult | null {
  if (!bucket || bucket.n === 0) return null;
  const mean = bucket.sum / bucket.n;
  const variance = Math.max(0, bucket.sumSq / bucket.n - mean * mean);
  const sd = Math.sqrt(variance);
  const boost = opts.isHoliday ? opts.holidayBoost ?? 1.2 : 1.0;
  return {
    expectedQty: Math.round(mean * boost),
    lowerQty: Math.max(0, Math.round((mean - sd) * boost)),
    upperQty: Math.round((mean + sd) * boost),
    sampleDays: bucket.n,
    method: opts.isHoliday ? 'seasonal_naive_holiday' : 'seasonal_naive',
  };
}

/** Indonesian 2026 nationwide holiday set — extend as Bank Indonesia publishes the calendar. */
export const ID_HOLIDAYS_2026: ReadonlySet<string> = new Set<string>([
  '2026-01-01',
  '2026-01-23',
  '2026-02-17',
  '2026-03-19',
  '2026-04-03',
  '2026-04-21',
  '2026-04-22',
  '2026-05-01',
  '2026-05-14',
  '2026-05-31',
  '2026-06-01',
  '2026-06-27',
  '2026-08-17',
  '2026-12-25',
]);

export function isHoliday2026(isoDate: string): boolean {
  return ID_HOLIDAYS_2026.has(isoDate);
}
