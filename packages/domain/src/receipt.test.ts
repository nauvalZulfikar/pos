import { describe, expect, it } from 'vitest';
import { fromRupiah } from './money.js';
import { renderReceiptText, textToEscPos } from './receipt.js';

describe('receipt', () => {
  const tenant = { displayName: 'Warung Demo', npwp: null, isPkp: false };
  const outlet = {
    name: 'Cabang Pusat',
    addressLine1: 'Jl. Merdeka 1',
    addressLine2: null,
    city: 'Jakarta',
    phone: '0812-3456',
  };

  it('renders centred header and totals', () => {
    const text = renderReceiptText({
      tenant,
      outlet,
      order: {
        outletOrderNumber: '0042',
        customerName: null,
        items: [
          {
            itemNameSnapshot: 'Nasi Goreng',
            quantity: 2,
            modifiers: [],
            notes: null,
            status: 'queued',
            lineSubtotal: fromRupiah(40_000),
          },
        ],
        subtotal: fromRupiah(40_000),
        discountTotal: BigInt(0),
        serviceCharge: BigInt(0),
        ppnTotal: BigInt(0),
        rounding: BigInt(0),
        total: fromRupiah(40_000),
        createdAt: '2026-05-05T05:00:00Z',
        paidAt: '2026-05-05T05:01:00Z',
      },
      kasirName: 'Andi',
      payments: [{ method: 'cash', amount: fromRupiah(40_000) }],
      paperWidthChars: 32,
    });
    expect(text).toContain('WARUNG DEMO');
    expect(text).toContain('No. 0042');
    expect(text).toContain('Nasi Goreng');
    expect(text).toContain('TOTAL');
    expect(text).toContain('Terima kasih');
  });

  it('skips voided line items', () => {
    const text = renderReceiptText({
      tenant,
      outlet,
      order: {
        outletOrderNumber: '0001',
        customerName: null,
        items: [
          {
            itemNameSnapshot: 'Should Not Appear',
            quantity: 1,
            modifiers: [],
            notes: null,
            status: 'voided',
            lineSubtotal: fromRupiah(10_000),
          },
        ],
        subtotal: BigInt(0),
        discountTotal: BigInt(0),
        serviceCharge: BigInt(0),
        ppnTotal: BigInt(0),
        rounding: BigInt(0),
        total: BigInt(0),
        createdAt: '2026-05-05T05:00:00Z',
        paidAt: null,
      },
      kasirName: 'Andi',
      payments: [],
      paperWidthChars: 32,
    });
    expect(text).not.toContain('Should Not Appear');
  });

  it('textToEscPos produces ESC/POS init+text+cut sequence', () => {
    const bytes = textToEscPos('hello');
    expect(bytes[0]).toBe(0x1b); // ESC
    expect(bytes[1]).toBe(0x40); // @
    expect(bytes[bytes.length - 4]).toBe(0x1d); // GS
    expect(bytes[bytes.length - 3]).toBe(0x56); // V
  });
});
