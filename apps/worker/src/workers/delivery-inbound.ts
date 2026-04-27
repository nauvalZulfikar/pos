/**
 * Process delivery webhook events: normalize to internal Order shape.
 *
 * Triggered by row insertion to delivery_webhook_events table (status='queued').
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, sql, desc } from '@desain/db';
import { jakartaIsoDate } from '@desain/domain';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type DeliveryInboundJob = {
  webhookEventId: string;
};

export function startDeliveryInboundWorker() {
  return new Worker<DeliveryInboundJob>(
    QueueName.deliveryInbound,
    async (job) => {
      const { webhookEventId } = job.data;
      const event = await db.query.deliveryWebhookEvents.findFirst({
        where: eq(schema.deliveryWebhookEvents.id, webhookEventId),
      });
      if (!event) {
        logger.warn({ webhookEventId }, 'delivery.inbound: event not found');
        return { ok: true, skipped: 'not_found' };
      }
      if (event.status === 'processed') {
        return { ok: true, skipped: 'already_processed' };
      }

      // Resolve platform link by external_merchant_id
      const body = (event.payload as { body: Record<string, unknown> }).body;
      const merchantId = (body as { outlet_id?: string }).outlet_id ?? '';

      const link = await db.query.deliveryPlatformLinks.findFirst({
        where: and(
          eq(schema.deliveryPlatformLinks.platform, event.platform),
          eq(schema.deliveryPlatformLinks.externalMerchantId, merchantId),
        ),
      });
      if (!link) {
        await db
          .update(schema.deliveryWebhookEvents)
          .set({ status: 'orphan', error: 'No matching platform link', processedAt: new Date() })
          .where(eq(schema.deliveryWebhookEvents.id, webhookEventId));
        return { ok: true, skipped: 'no_link' };
      }

      const tenantId = link.tenantId;
      const outletId = link.outletId;
      const externalOrderId =
        (body as { order_id?: string }).order_id ?? `unknown-${event.externalEventId}`;

      const existing = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.tenantId, tenantId),
          eq(schema.orders.externalOrderId, externalOrderId),
        ),
      });
      if (existing) {
        await db
          .update(schema.deliveryWebhookEvents)
          .set({ status: 'processed', processedAt: new Date() })
          .where(eq(schema.deliveryWebhookEvents.id, webhookEventId));
        return { ok: true, skipped: 'duplicate', orderId: existing.id };
      }

      const orderId = uuidv7();
      const businessDay = jakartaIsoDate();

      const lastNum = await db.query.orders.findFirst({
        where: and(
          eq(schema.orders.tenantId, tenantId),
          eq(schema.orders.outletId, outletId),
          eq(schema.orders.businessDay, businessDay),
        ),
        orderBy: [desc(schema.orders.outletOrderNumber)],
      });
      const nextNum = (lastNum ? Number(lastNum.outletOrderNumber) + 1 : 1)
        .toString()
        .padStart(4, '0');

      await db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
        await tx.insert(schema.orders).values({
          id: orderId,
          tenantId,
          outletId,
          shiftId: null,
          tableId: null,
          outletOrderNumber: nextNum,
          businessDay,
          source: event.platform as 'gofood' | 'grabfood' | 'shopeefood',
          pricingProfile: 'delivery',
          status: 'sent_to_kitchen',
          customerName: (body as { customer?: { name?: string } }).customer?.name ?? null,
          customerPhone: (body as { customer?: { phone?: string } }).customer?.phone ?? null,
          guestCount: null,
          subtotal: BigInt(0),
          discountTotal: BigInt(0),
          serviceCharge: BigInt(0),
          ppnTotal: BigInt(0),
          rounding: BigInt(0),
          total: BigInt(0),
          discounts: [],
          notes: `[${event.platform.toUpperCase()}] Auto-imported`,
          externalOrderId,
          receivedAt: new Date(),
        });

        await tx
          .update(schema.deliveryWebhookEvents)
          .set({ status: 'processed', processedAt: new Date() })
          .where(eq(schema.deliveryWebhookEvents.id, webhookEventId));
      });

      logger.info(
        { tenantId, outletId, orderId, platform: event.platform },
        'delivery.inbound: order imported',
      );
      return { ok: true, orderId };
    },
    { connection, concurrency: 8 },
  );
}
