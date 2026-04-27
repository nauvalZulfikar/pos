/**
 * Midtrans Snap adapter. Production wiring goes here.
 *
 * Webhook signature: sha512(orderId + statusCode + grossAmount + serverKey).
 */

import { createHash } from 'node:crypto';
import type {
  CreateIntentParams,
  PaymentIntent,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from './types.js';
import type { Money } from '@desain/types';

export type MidtransConfig = {
  serverKey: string;
  isProduction: boolean;
  /** Override base URL if needed. */
  baseUrl?: string;
};

export class MidtransProvider implements PaymentProvider {
  readonly id = 'midtrans' as const;

  constructor(private readonly cfg: MidtransConfig) {}

  private get apiBase(): string {
    if (this.cfg.baseUrl) return this.cfg.baseUrl;
    return this.cfg.isProduction
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.cfg.serverKey}:`).toString('base64')}`;
  }

  async createIntent(params: CreateIntentParams): Promise<PaymentIntent> {
    const body = {
      payment_type: midtransPaymentType(params.method),
      transaction_details: {
        order_id: `${params.orderId}`,
        gross_amount: Number(params.amount / BigInt(100)), // sen → IDR
      },
      customer_details: {
        first_name: params.customerName ?? 'Kasir',
        phone: params.customerPhone ?? undefined,
      },
      qris: params.method === 'qris' ? { acquirer: 'gopay' } : undefined,
    };

    const res = await fetch(`${this.apiBase}/v2/charge`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`midtrans charge failed: ${res.status} ${await res.text()}`);
    }

    const json = (await res.json()) as MidtransChargeResponse;
    return {
      providerRef: json.transaction_id,
      qrPayload: json.actions?.find((a) => a.name === 'generate-qr-code')?.url ?? json.qr_string,
      redirectUrl: json.redirect_url,
      expiresAt: json.expiry_time ?? new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  parseWebhook(headers: Record<string, string | undefined>, body: unknown): WebhookEvent {
    const payload = body as MidtransWebhookPayload;
    const expected = createHash('sha512')
      .update(
        `${payload.order_id}${payload.status_code}${payload.gross_amount}${this.cfg.serverKey}`,
      )
      .digest('hex');
    if (expected !== payload.signature_key) {
      throw new Error('midtrans webhook signature invalid');
    }
    return {
      providerRef: payload.transaction_id,
      externalEventId: `${payload.transaction_id}:${payload.transaction_status}`,
      status: midtransToStatus(payload.transaction_status),
      paidAmount: BigInt(Math.round(Number(payload.gross_amount) * 100)) as Money,
      paidAt: payload.settlement_time ?? payload.transaction_time,
      raw: body,
    };
  }

  async refund(paymentId: string, amount: Money, reason: string): Promise<RefundResult> {
    const res = await fetch(`${this.apiBase}/v2/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: this.authHeader,
      },
      body: JSON.stringify({
        amount: Number(amount / BigInt(100)),
        reason,
      }),
    });
    if (!res.ok) throw new Error(`midtrans refund failed: ${res.status}`);
    const json = (await res.json()) as MidtransRefundResponse;
    return {
      externalRefundId: json.refund_key ?? json.refund_id ?? json.transaction_id,
      status: json.status_code === '200' ? 'succeeded' : 'pending',
      refundedAmount: amount,
    };
  }
}

function midtransPaymentType(method: CreateIntentParams['method']): string {
  switch (method) {
    case 'qris':
      return 'qris';
    case 'gopay':
      return 'gopay';
    case 'ovo':
      return 'ovo';
    case 'dana':
    case 'shopeepay':
      return 'qris'; // routed via QRIS aggregator
    case 'bank_transfer':
      return 'bank_transfer';
    case 'card_edc':
      return 'credit_card';
    default:
      return 'qris';
  }
}

function midtransToStatus(s: string): WebhookEvent['status'] {
  switch (s) {
    case 'settlement':
    case 'capture':
      return 'settled';
    case 'expire':
      return 'expired';
    case 'cancel':
    case 'deny':
    case 'failure':
      return 'failed';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    default:
      return 'failed';
  }
}

type MidtransChargeResponse = {
  transaction_id: string;
  redirect_url?: string;
  qr_string?: string;
  expiry_time?: string;
  actions?: Array<{ name: string; url: string }>;
};

type MidtransWebhookPayload = {
  transaction_id: string;
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_time: string;
  settlement_time?: string;
};

type MidtransRefundResponse = {
  status_code: string;
  refund_key?: string;
  refund_id?: string;
  transaction_id: string;
};
