/**
 * ShopeeFood Open Platform adapter — scaffolding only.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DeliveryEvent, DeliveryProvider, MenuPushPayload } from '../types.js';

export type ShopeeFoodConfig = {
  partnerId: string;
  partnerKey: string;
  webhookSecret: string;
  baseUrl?: string;
};

export class ShopeeFoodProvider implements DeliveryProvider {
  readonly id = 'shopeefood' as const;
  constructor(private readonly cfg: ShopeeFoodConfig) {}

   
  async syncMenu(_payload: MenuPushPayload): Promise<{ pushedCount: number; skipped: number }> {
    throw new Error('ShopeeFoodProvider.syncMenu not yet implemented');
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
    const provided = headers['x-shopee-signature'];
    const raw = JSON.stringify(body);
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(raw).digest('hex');
    if (!provided || provided.length !== expected.length) throw new Error('shopeefood signature mismatch');
    if (!timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'))) {
      throw new Error('shopeefood signature mismatch');
    }
    const evt = body as { event_id: string; order_id: string; type: string };
    return {
      type: 'order_status',
      externalEventId: evt.event_id,
      externalOrderId: evt.order_id,
      status: evt.type,
      raw: body,
    };
  }
}
