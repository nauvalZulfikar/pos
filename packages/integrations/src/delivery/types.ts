/**
 * Delivery provider adapter contract. AGENTS.md §13.1.
 */

import type { CreateOrderInput } from '@desain/types';

export type PlatformId = 'gofood' | 'grabfood' | 'shopeefood';

export type MenuPushItem = {
  externalId?: string;
  /** Our internal menu item id. */
  menuItemId: string;
  name: string;
  description?: string;
  price: bigint;
  imageUrl?: string;
  available: boolean;
  category: string;
};

export type MenuPushPayload = {
  outletExternalId: string;
  items: MenuPushItem[];
};

export type DeliveryEvent =
  | {
      type: 'order_created';
      externalEventId: string;
      externalOrderId: string;
      outletExternalId: string;
      receivedAt: string;
      orderInput: CreateOrderInput;
      raw: unknown;
    }
  | {
      type: 'order_cancelled';
      externalEventId: string;
      externalOrderId: string;
      reason?: string;
      raw: unknown;
    }
  | {
      type: 'order_status';
      externalEventId: string;
      externalOrderId: string;
      status: string;
      raw: unknown;
    };

export interface DeliveryProvider {
  readonly id: PlatformId;
  syncMenu(payload: MenuPushPayload): Promise<{ pushedCount: number; skipped: number }>;
  setItemAvailability(externalItemId: string, available: boolean): Promise<void>;
  acceptOrder(externalOrderId: string): Promise<void>;
  rejectOrder(externalOrderId: string, reason: string): Promise<void>;
  parseWebhook(
    headers: Record<string, string | undefined>,
    body: unknown,
  ): DeliveryEvent;
}
