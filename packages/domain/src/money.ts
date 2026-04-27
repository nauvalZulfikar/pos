/**
 * Money arithmetic — integer minor units only. Never floats.
 * IDR has 2 nominal decimals; we store ×100 of IDR (i.e., "sen").
 *
 * AGENTS.md §5.3, §27.2.
 */

export type Sen = bigint;

export const ZERO: Sen = BigInt(0);

export function fromRupiah(rupiah: number | string): Sen {
  if (typeof rupiah === 'number') {
    if (!Number.isFinite(rupiah)) throw new RangeError('non-finite rupiah');
    if (Math.abs(rupiah) > Number.MAX_SAFE_INTEGER / 100)
      throw new RangeError('rupiah out of safe range');
    // Avoid float drift via string conversion at fixed precision.
    return fromRupiahString(rupiah.toFixed(2));
  }
  return fromRupiahString(rupiah);
}

function fromRupiahString(s: string): Sen {
  const trimmed = s.trim();
  const m = /^(-?)(\d+)(?:[.,](\d{1,2}))?$/.exec(trimmed);
  if (!m) throw new RangeError(`invalid rupiah: ${s}`);
  const [, sign, whole, frac = '00'] = m;
  const fracPadded = (frac + '00').slice(0, 2);
  const sen = BigInt(whole!) * BigInt(100) + BigInt(fracPadded);
  return sign === '-' ? -sen : sen;
}

export function toRupiahNumber(sen: Sen): number {
  // For display only; never feed back into arithmetic.
  const negative = sen < ZERO;
  const abs = negative ? -sen : sen;
  const whole = Number(abs / BigInt(100));
  const frac = Number(abs % BigInt(100)) / 100;
  const value = whole + frac;
  return negative ? -value : value;
}

export function add(a: Sen, b: Sen): Sen {
  return a + b;
}

export function sub(a: Sen, b: Sen): Sen {
  return a - b;
}

export function mul(a: Sen, n: number | bigint): Sen {
  if (typeof n === 'bigint') return a * n;
  if (!Number.isInteger(n)) throw new RangeError('multiplier must be integer');
  return a * BigInt(n);
}

/** Apply basis-points multiplier (10000 bps = 100%). Banker's rounding to nearest sen. */
export function bps(a: Sen, basisPoints: number): Sen {
  if (!Number.isInteger(basisPoints)) throw new RangeError('bps must be integer');
  if (basisPoints === 0) return ZERO;
  const product = a * BigInt(basisPoints);
  return divRoundHalfEven(product, BigInt(10_000));
}

/** Round to the nearest unit (e.g. nearest Rp1 = unit 100, nearest Rp50 = 5000). */
export function roundTo(a: Sen, unit: bigint): Sen {
  if (unit <= BigInt(0)) throw new RangeError('unit must be positive');
  return divRoundHalfEven(a, unit) * unit;
}

/** Banker's rounding (half-to-even) for bigints. */
export function divRoundHalfEven(num: bigint, den: bigint): bigint {
  if (den === BigInt(0)) throw new RangeError('div by zero');
  const negative = num < BigInt(0) !== den < BigInt(0);
  const aNum = num < BigInt(0) ? -num : num;
  const aDen = den < BigInt(0) ? -den : den;
  const q = aNum / aDen;
  const r = aNum % aDen;
  const twice = r * BigInt(2);
  let rounded = q;
  if (twice > aDen) rounded += BigInt(1);
  else if (twice === aDen) rounded += q % BigInt(2);
  return negative ? -rounded : rounded;
}

export function sum(values: readonly Sen[]): Sen {
  let acc = ZERO;
  for (const v of values) acc += v;
  return acc;
}

export function max(a: Sen, b: Sen): Sen {
  return a > b ? a : b;
}

export function min(a: Sen, b: Sen): Sen {
  return a < b ? a : b;
}

/** Format as "Rp 1.234.567" (no decimals when whole). */
export function formatIDR(sen: Sen, opts: { withDecimals?: boolean } = {}): string {
  const negative = sen < ZERO;
  const abs = negative ? -sen : sen;
  const whole = abs / BigInt(100);
  const frac = abs % BigInt(100);
  const wholeStr = formatThousands(whole);
  const body =
    opts.withDecimals || frac !== BigInt(0)
      ? `${wholeStr},${frac.toString().padStart(2, '0')}`
      : wholeStr;
  return `${negative ? '-' : ''}Rp ${body}`;
}

function formatThousands(n: bigint): string {
  const s = n.toString();
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out.push('.');
    out.push(s[i]!);
  }
  return out.join('');
}
