/**
 * Tax computation per AGENTS.md §15 + Indonesian F&B convention.
 *
 * Order of operations:
 *   1. Sum item subtotals (after item-level discounts).
 *   2. Apply order-level discount → discountedSubtotal.
 *   3. Compute service charge on discountedSubtotal.
 *   4. PPN base = discountedSubtotal + serviceCharge.
 *   5. PPN = PPN base × ppnBps  (per-item override aggregates if any items differ).
 *   6. Total = discountedSubtotal + serviceCharge + ppnTotal + rounding.
 *
 * Pure function — easy to test, no I/O.
 */

import { ZERO, bps, divRoundHalfEven, max, sum } from './money.js';
import type { Sen } from './money.js';

export type LineForTax = {
  /** lineSubtotal after item-level modifiers, BEFORE discount. */
  lineSubtotal: Sen;
  /** PPN bps for this line (item override, or tenant default). 1100 = 11%. */
  ppnBps: number;
};

export type TaxInput = {
  lines: readonly LineForTax[];
  /** Order-level discount (always positive sen value to subtract). */
  orderDiscount: Sen;
  /** Service charge bps applied to discounted subtotal. 0 = none. */
  serviceChargeBps: number;
  /** Tenant is PKP? If false, ppnTotal is forced to 0. */
  tenantIsPkp: boolean;
  /** Round total to nearest unit (e.g. 100 sen = Rp1). 0 = no rounding. */
  roundingUnit: bigint;
};

export type TaxBreakdown = {
  subtotal: Sen;
  discountTotal: Sen;
  discountedSubtotal: Sen;
  serviceCharge: Sen;
  ppnBase: Sen;
  ppnTotal: Sen;
  rounding: Sen;
  total: Sen;
};

export function computeTax(input: TaxInput): TaxBreakdown {
  const subtotal = sum(input.lines.map((l) => l.lineSubtotal));
  const cappedDiscount = subtotal < input.orderDiscount ? subtotal : input.orderDiscount;
  const discountedSubtotal = subtotal - cappedDiscount;

  const serviceCharge = bps(discountedSubtotal, input.serviceChargeBps);
  const ppnBase = discountedSubtotal + serviceCharge;

  const ppnTotal = input.tenantIsPkp ? computeMixedPpn(input.lines, cappedDiscount, serviceCharge) : ZERO;

  const preRoundTotal = discountedSubtotal + serviceCharge + ppnTotal;
  const rounded = input.roundingUnit > BigInt(0) ? roundUp(preRoundTotal, input.roundingUnit) : preRoundTotal;
  const rounding = rounded - preRoundTotal;

  return {
    subtotal,
    discountTotal: cappedDiscount,
    discountedSubtotal,
    serviceCharge,
    ppnBase,
    ppnTotal,
    rounding,
    total: rounded,
  };
}

/**
 * Mixed-rate PPN: if items have different ppnBps (rare — e.g. bottled water resold differently),
 * we compute proportionally. For uniform items, this collapses to bps(ppnBase, rate).
 *
 * The order-level discount and service charge are pro-rated by line subtotal so each line's
 * PPN base is consistent.
 */
function computeMixedPpn(
  lines: readonly LineForTax[],
  orderDiscount: Sen,
  serviceCharge: Sen,
): Sen {
  const subtotal = sum(lines.map((l) => l.lineSubtotal));
  if (subtotal === ZERO) return ZERO;

  let ppnAcc = ZERO;
  let allocatedDiscount = ZERO;
  let allocatedService = ZERO;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const isLast = i === lines.length - 1;
    const lineDiscount = isLast
      ? orderDiscount - allocatedDiscount
      : divRoundHalfEven(line.lineSubtotal * orderDiscount, subtotal);
    const lineService = isLast
      ? serviceCharge - allocatedService
      : divRoundHalfEven(line.lineSubtotal * serviceCharge, subtotal);
    allocatedDiscount += lineDiscount;
    allocatedService += lineService;

    const linePpnBase = max(ZERO, line.lineSubtotal - lineDiscount + lineService);
    ppnAcc += bps(linePpnBase, line.ppnBps);
  }

  return ppnAcc;
}

function roundUp(value: Sen, unit: bigint): Sen {
  if (unit <= BigInt(0)) return value;
  const r = value % unit;
  if (r === BigInt(0)) return value;
  if (value < BigInt(0)) return value - r;
  return value + (unit - r);
}

/** Convenience for the simple case used by the kasir UI in real time. */
export function quickTotal(opts: {
  subtotal: Sen;
  discount: Sen;
  serviceChargeBps: number;
  ppnBps: number;
  tenantIsPkp: boolean;
  roundingUnit?: bigint;
}): TaxBreakdown {
  return computeTax({
    lines: [{ lineSubtotal: opts.subtotal, ppnBps: opts.ppnBps }],
    orderDiscount: opts.discount,
    serviceChargeBps: opts.serviceChargeBps,
    tenantIsPkp: opts.tenantIsPkp,
    roundingUnit: opts.roundingUnit ?? BigInt(0),
  });
}
