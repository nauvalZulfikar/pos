import { describe, expect, it } from 'vitest';
import { fromRupiah } from './money.js';
import { computeLineSubtotal, computeOrderTotals, totalAmountPaid } from './order.js';

describe('order', () => {
  describe('computeLineSubtotal', () => {
    it('multiplies (unit + modifiers) × quantity', () => {
      expect(
        computeLineSubtotal({
          unitPrice: fromRupiah(15_000),
          modifiersTotal: fromRupiah(2_500),
          quantity: 3,
        }),
      ).toBe(fromRupiah(52_500));
    });

    it('rejects non-positive integer quantity', () => {
      expect(() =>
        computeLineSubtotal({ unitPrice: BigInt(0), modifiersTotal: BigInt(0), quantity: 0 }),
      ).toThrow();
      expect(() =>
        computeLineSubtotal({ unitPrice: BigInt(0), modifiersTotal: BigInt(0), quantity: -1 }),
      ).toThrow();
      expect(() =>
        computeLineSubtotal({ unitPrice: BigInt(0), modifiersTotal: BigInt(0), quantity: 1.5 }),
      ).toThrow();
    });
  });

  describe('computeOrderTotals', () => {
    it('skips voided items from totals', () => {
      const t = computeOrderTotals({
        items: [
          { lineSubtotal: fromRupiah(10_000), ppnBpsSnapshot: 1100, status: 'queued' },
          { lineSubtotal: fromRupiah(20_000), ppnBpsSnapshot: 1100, status: 'voided' },
        ],
        orderDiscount: BigInt(0),
        serviceChargeBps: 0,
        tenantIsPkp: true,
      });
      expect(t.subtotal).toBe(fromRupiah(10_000));
      expect(t.ppnTotal).toBe(fromRupiah(1_100));
      expect(t.total).toBe(fromRupiah(11_100));
    });

    it('non-PKP tenant has zero PPN', () => {
      const t = computeOrderTotals({
        items: [{ lineSubtotal: fromRupiah(10_000), ppnBpsSnapshot: 1100, status: 'queued' }],
        orderDiscount: BigInt(0),
        serviceChargeBps: 0,
        tenantIsPkp: false,
      });
      expect(t.ppnTotal).toBe(BigInt(0));
      expect(t.total).toBe(fromRupiah(10_000));
    });
  });

  describe('totalAmountPaid', () => {
    it('sums settled and awaiting_settlement', () => {
      const t = totalAmountPaid([
        { amount: fromRupiah(15_000), status: 'settled' },
        { amount: fromRupiah(5_000), status: 'awaiting_settlement' },
        { amount: fromRupiah(99_000), status: 'failed' },
        { amount: fromRupiah(99_000), status: 'pending' },
      ]);
      expect(t).toBe(fromRupiah(20_000));
    });
  });
});
