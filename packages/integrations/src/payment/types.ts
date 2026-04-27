/**
 * Payment provider adapter contract. AGENTS.md §12.6.
 * Switching providers per tenant is a config change.
 */

import type { Money } from '@desain/types';

export type ProviderId = 'midtrans' | 'xendit' | 'manual';

export type CreateIntentParams = {
  tenantId: string;
  outletId: string;
  orderId: string;
  amount: Money;
  method: 'qris' | 'gopay' | 'ovo' | 'dana' | 'shopeepay' | 'card_edc' | 'bank_transfer';
  customerName?: string | null;
  customerPhone?: string | null;
  description?: string;
};

export type PaymentIntent = {
  providerRef: string;
  /** Rendered QR string (for QRIS / e-wallet methods). */
  qrPayload?: string;
  /** Optional redirect URL for non-QR methods. */
  redirectUrl?: string;
  expiresAt: string;
};

export type WebhookEvent = {
  providerRef: string;
  externalEventId: string;
  status: 'settled' | 'failed' | 'expired' | 'refunded';
  paidAmount: Money;
  paidAt: string;
  raw: unknown;
};

export type RefundResult = {
  externalRefundId: string;
  status: 'pending' | 'succeeded' | 'failed';
  refundedAmount: Money;
};

export interface PaymentProvider {
  readonly id: ProviderId;
  createIntent(params: CreateIntentParams): Promise<PaymentIntent>;
  parseWebhook(headers: Record<string, string | undefined>, body: unknown): WebhookEvent;
  refund(paymentId: string, amount: Money, reason: string): Promise<RefundResult>;
}
