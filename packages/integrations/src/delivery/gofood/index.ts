/**
 * GoFood (GoBiz Merchant API) adapter — initial scaffolding.
 * Real signature/oauth2 flow needs production credentials and partnership KYB.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  DeliveryEvent,
  DeliveryProvider,
  MenuPushPayload,
} from '../types.js';

export type GoFoodConfig = {
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  baseUrl?: string;
};

export class GoFoodProvider implements DeliveryProvider {
  readonly id = 'gofood' as const;

  constructor(private readonly cfg: GoFoodConfig) {}

   
  async syncMenu(_payload: MenuPushPayload): Promise<{ pushedCount: number; skipped: number }> {
    // TODO: implement against GoFood Merchant API.
    throw new Error('GoFoodProvider.syncMenu not yet implemented (waiting on GoBiz credentials)');
  }

   
  async setItemAvailability(_externalItemId: string, _available: boolean): Promise<void> {
    throw new Error('not implemented');
  }

   
  async acceptOrder(_externalOrderId: string): Promise<void> {
    throw new Error('not implemented');
  }

   
  async rejectOrder(_externalOrderId: string, _reason: string): Promise<void> {
    throw new Error('not implemented');
  }

  parseWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
  ): DeliveryEvent {
    const provided = headers['x-gobiz-signature'];
    const raw = JSON.stringify(body);
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(raw).digest('hex');
    if (!provided || !safeEqual(provided, expected)) {
      throw new Error('gofood signature mismatch');
    }
    const evt = body as GoFoodWebhookPayload;
    if (evt.event === 'order.created') {
      return {
        type: 'order_created',
        externalEventId: evt.event_id,
        externalOrderId: evt.order.order_id,
        outletExternalId: evt.outlet_id,
        receivedAt: evt.event_timestamp,
        orderInput: {
          outletId: '__resolved_at_router__' as never,
          shiftId: null,
          tableId: null,
          source: 'gofood',
          pricingProfile: 'delivery',
          customerName: evt.customer?.name ?? null,
          customerPhone: evt.customer?.phone ?? null,
          guestCount: null,
          items: evt.order.items.map((i) => ({
            menuItemId: '__resolve_by_external_id__' as never,
            quantity: i.quantity,
            modifiers: i.modifiers?.map((m) => ({ modifierId: m.id as never })) ?? [],
            notes: i.notes ?? null,
          })),
          notes: evt.order.notes ?? null,
        },
        raw: body,
      };
    }
    if (evt.event === 'order.cancelled') {
      return {
        type: 'order_cancelled',
        externalEventId: evt.event_id,
        externalOrderId: evt.order.order_id,
        reason: evt.cancellation?.reason,
        raw: body,
      };
    }
    return {
      type: 'order_status',
      externalEventId: evt.event_id,
      externalOrderId: evt.order.order_id,
      status: evt.event,
      raw: body,
    };
  }
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a, 'hex');
  const bBuf = Buffer.from(b, 'hex');
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

type GoFoodWebhookPayload = {
  event: 'order.created' | 'order.cancelled' | 'order.delivered' | string;
  event_id: string;
  event_timestamp: string;
  outlet_id: string;
  order: {
    order_id: string;
    notes?: string;
    items: Array<{
      external_item_id: string;
      quantity: number;
      modifiers?: Array<{ id: string }>;
      notes?: string;
    }>;
  };
  customer?: { name?: string; phone?: string };
  cancellation?: { reason?: string };
};
