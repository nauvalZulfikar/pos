import { describe, expect, it } from 'vitest';
import { buildPaymentProvider } from './index.js';

describe('buildPaymentProvider', () => {
  it('returns midtrans provider when id=midtrans', () => {
    const p = buildPaymentProvider('midtrans', {
      midtrans: { serverKey: 'k', isProduction: false },
    });
    expect(p.id).toBe('midtrans');
  });

  it('returns xendit provider when id=xendit', () => {
    const p = buildPaymentProvider('xendit', {
      xendit: { secretKey: 'k', webhookToken: 't' },
    });
    expect(p.id).toBe('xendit');
  });

  it('throws when config for selected provider is missing', () => {
    expect(() => buildPaymentProvider('midtrans', {})).toThrow();
    expect(() => buildPaymentProvider('xendit', {})).toThrow();
  });

  it('throws on unknown provider id', () => {
    expect(() => buildPaymentProvider('manual', {})).toThrow();
  });
});
