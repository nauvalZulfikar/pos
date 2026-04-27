/**
 * GrabFood Merchant API adapter — scaffolding only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DeliveryEvent, DeliveryProvider, MenuPushPayload } from '../types.js';

export type GrabFoodConfig = {
  partnerId: string;
  partnerSecret: string;
  webhookSecret: string;
  baseUrl?: string;
};

export class GrabFoodProvider implements DeliveryProvider {
  readonly id = 'grabfood' as const;

  constructor(private readonly cfg: GrabFoodConfig) {}

   
  async syncMenu(_payload: MenuPushPayload): Promise<{ pushedCount: number; skipped: number }> {
    throw new Error('GrabFoodProvider.syncMenu not yet implemented');
  }
   
  async setItemAvailability(_id: string, _available: boolean): Promise<void> {
    throw new Error('not implemented');
  }
   
  async acceptOrder(_id: string): Promise<void> {
    throw new Error('not implemented');
  }
   
  async rejectOrder(_id: string, _reason: string): Promise<void> {
    throw new Error('not implemented');
  }

  parseWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
  ): DeliveryEvent {
    const provided = headers['x-grab-signature'];
    const raw = JSON.stringify(body);
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(raw).digest('hex');
    if (!provided || !safeEqualHex(provided, expected)) {
      throw new Error('grabfood signature mismatch');
    }
    const evt = body as { event_id: string; order_id: string; type: string; outlet_id: string };
    return {
      type: 'order_status',
      externalEventId: evt.event_id,
      externalOrderId: evt.order_id,
      status: evt.type,
      raw: body,
    };
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
