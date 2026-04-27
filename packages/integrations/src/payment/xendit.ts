/**
 * Xendit fallback adapter — minimal stub. Production wiring TBD.
 */

import type {
  CreateIntentParams,
  PaymentIntent,
  PaymentProvider,
  RefundResult,
  WebhookEvent,
} from './types.js';
import type { Money } from '@desain/types';

export type XenditConfig = {
  secretKey: string;
  webhookToken: string;
};

export class XenditProvider implements PaymentProvider {
  readonly id = 'xendit' as const;
  constructor(private readonly cfg: XenditConfig) {}

   
  async createIntent(_params: CreateIntentParams): Promise<PaymentIntent> {
    throw new Error('XenditProvider.createIntent not yet implemented');
  }

  parseWebhook(headers: Record<string, string | undefined>, body: unknown): WebhookEvent {
    const token = headers['x-callback-token'];
    if (token !== this.cfg.webhookToken) throw new Error('xendit token mismatch');
    const payload = body as { id: string; status: string; amount: number; updated: string };
    return {
      providerRef: payload.id,
      externalEventId: `${payload.id}:${payload.status}`,
      status:
        payload.status === 'PAID' || payload.status === 'SUCCEEDED' ? 'settled' : 'failed',
      paidAmount: BigInt(Math.round(payload.amount * 100)) as Money,
      paidAt: payload.updated,
      raw: body,
    };
  }

   
  async refund(_paymentId: string, _amount: Money, _reason: string): Promise<RefundResult> {
    throw new Error('XenditProvider.refund not yet implemented');
  }
}
