/**
 * Order computation — pure recomputation from items + discounts + outlet config.
 * Used by both server and terminal.
 */

import { sum } from './money.js';
import type { Sen } from './money.js';
import { computeTax } from './tax.js';

/** Plain shape for items — avoids the Zod brand so calling code can pass either. */
export type OrderTotalsLine = {
  lineSubtotal: bigint;
  ppnBpsSnapshot: number;
  status: string;
};

export type OrderTotalsInput = {
  items: readonly OrderTotalsLine[];
  orderDiscount: Sen;
  serviceChargeBps: number;
  tenantIsPkp: boolean;
  roundingUnit?: bigint;
};

/**
 * Plain-bigint totals — internal computation type. The Zod `Order` schema brands
 * these as `Money`; cast at the boundary when persisting.
 */
export type OrderTotals = {
  subtotal: bigint;
  discountTotal: bigint;
  serviceCharge: bigint;
  ppnTotal: bigint;
  rounding: bigint;
  total: bigint;
};

export function computeOrderTotals(input: OrderTotalsInput): OrderTotals {
  const live = input.items.filter((i) => i.status !== 'voided');
  const breakdown = computeTax({
    lines: live.map((i) => ({
      lineSubtotal: i.lineSubtotal,
      ppnBps: i.ppnBpsSnapshot,
    })),
    orderDiscount: input.orderDiscount,
    serviceChargeBps: input.serviceChargeBps,
    tenantIsPkp: input.tenantIsPkp,
    roundingUnit: input.roundingUnit ?? BigInt(0),
  });
  return {
    subtotal: breakdown.subtotal,
    discountTotal: breakdown.discountTotal,
    serviceCharge: breakdown.serviceCharge,
    ppnTotal: breakdown.ppnTotal,
    rounding: breakdown.rounding,
    total: breakdown.total,
  };
}

export function computeLineSubtotal(opts: {
  unitPrice: Sen;
  modifiersTotal: bigint;
  quantity: number;
}): Sen {
  if (!Number.isInteger(opts.quantity) || opts.quantity <= 0)
    throw new RangeError('quantity must be positive integer');
  return (opts.unitPrice + opts.modifiersTotal) * BigInt(opts.quantity);
}

export function totalAmountPaid(payments: readonly { amount: Sen; status: string }[]): Sen {
  return sum(
    payments
      .filter((p) => p.status === 'settled' || p.status === 'awaiting_settlement')
      .map((p) => p.amount),
  );
}
