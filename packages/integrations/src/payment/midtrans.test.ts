import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { MidtransProvider } from './midtrans.js';

describe('MidtransProvider', () => {
  const cfg = { serverKey: 'SB-Mid-server-test', isProduction: false };
  const provider = new MidtransProvider(cfg);

  it('parseWebhook accepts valid signature_key', () => {
    const orderId = 'order-123';
    const statusCode = '200';
    const grossAmount = '50000.00';
    const sigKey = createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${cfg.serverKey}`)
      .digest('hex');

    const event = provider.parseWebhook(
      {},
      {
        transaction_id: 'tx-456',
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: sigKey,
        transaction_status: 'settlement',
        transaction_time: '2026-05-05 12:00:00',
        settlement_time: '2026-05-05 12:00:01',
      },
    );
    expect(event.providerRef).toBe('tx-456');
    expect(event.status).toBe('settled');
    expect(event.paidAmount).toBe(BigInt(50_000 * 100));
  });

  it('parseWebhook rejects invalid signature_key', () => {
    expect(() =>
      provider.parseWebhook(
        {},
        {
          transaction_id: 'tx',
          order_id: 'o',
          status_code: '200',
          gross_amount: '0.00',
          signature_key: 'bogus',
          transaction_status: 'settlement',
          transaction_time: '2026-05-05 12:00:00',
        },
      ),
    ).toThrow();
  });

  it('parseWebhook maps status correctly', () => {
    const make = (status: string) => {
      const orderId = 'o';
      const statusCode = '200';
      const grossAmount = '0.00';
      const sigKey = createHash('sha512')
        .update(`${orderId}${statusCode}${grossAmount}${cfg.serverKey}`)
        .digest('hex');
      return provider.parseWebhook(
        {},
        {
          transaction_id: 't',
          order_id: orderId,
          status_code: statusCode,
          gross_amount: grossAmount,
          signature_key: sigKey,
          transaction_status: status,
          transaction_time: '2026-05-05 00:00:00',
        },
      );
    };
    expect(make('settlement').status).toBe('settled');
    expect(make('capture').status).toBe('settled');
    expect(make('expire').status).toBe('expired');
    expect(make('cancel').status).toBe('failed');
    expect(make('refund').status).toBe('refunded');
  });
});
