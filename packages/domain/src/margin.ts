/**
 * Margin-after-commission per platform per menu item.
 * AGENTS.md §13.4.
 */

import { ZERO, bps } from './money.js';
import type { Sen } from './money.js';

export type PlatformCommission = {
  platform: 'gofood' | 'grabfood' | 'shopeefood' | 'whatsapp' | 'web';
  /** Commission in bps (e.g. 2000 = 20%). */
  commissionBps: number;
};

export type MarginInput = {
  menuPrice: Sen;
  recipeCost: Sen;
  commissionBps: number;
};

export type MarginResult = {
  menuPrice: Sen;
  recipeCost: Sen;
  commissionAmount: Sen;
  netReceived: Sen;
  marginAmount: Sen;
  /** Margin / netReceived in bps. Returns 0 if netReceived is 0. */
  marginBps: number;
};

export function computeMargin(input: MarginInput): MarginResult {
  const commissionAmount = bps(input.menuPrice, input.commissionBps);
  const netReceived = input.menuPrice - commissionAmount;
  const marginAmount = netReceived - input.recipeCost;
  const marginBps =
    netReceived === ZERO ? 0 : Number((marginAmount * BigInt(10_000)) / netReceived);
  return {
    menuPrice: input.menuPrice,
    recipeCost: input.recipeCost,
    commissionAmount,
    netReceived,
    marginAmount,
    marginBps,
  };
}
