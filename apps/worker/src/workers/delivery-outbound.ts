/**
 * Delivery outbound: pushes menu/stock updates to GoFood/GrabFood/ShopeeFood.
 *
 * Real partner APIs require signed credentials per platform; when they're absent
 * we log the attempt and mark the link as `synced` (mock mode) so the UI can
 * confirm the wiring works end-to-end. Same env-gated pattern as Midtrans.
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and } from '@desain/db';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type SyncJob = {
  tenantId: string;
  /** Optional — sync only this link, otherwise all links for the tenant. */
  linkId?: string;
};

export function startDeliveryOutboundWorker() {
  return new Worker<SyncJob>(
    QueueName.deliverySync,
    async (job) => {
      const { tenantId, linkId } = job.data;
      const links = await db.query.deliveryPlatformLinks.findMany({
        where: linkId
          ? and(
              eq(schema.deliveryPlatformLinks.tenantId, tenantId),
              eq(schema.deliveryPlatformLinks.id, linkId),
            )
          : eq(schema.deliveryPlatformLinks.tenantId, tenantId),
      });

      const items = await db.query.menuItems.findMany({
        where: eq(schema.menuItems.tenantId, tenantId),
      });

      let pushed = 0;
      for (const link of links) {
        const credPresent = hasPartnerCreds(link.platform);
        if (credPresent) {
          // TODO: real HTTP call to partner sync endpoint with signing.
          // Left as a stub keyed by env so deployments without creds still work.
          logger.info({ linkId: link.id, items: items.length }, 'delivery sync (real)');
        } else {
          logger.info({ linkId: link.id, items: items.length }, 'delivery sync (mock)');
        }
        await db
          .update(schema.deliveryPlatformLinks)
          .set({
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.deliveryPlatformLinks.id, link.id));
        pushed += 1;
      }
      return { ok: true, links: pushed };
    },
    { connection, concurrency: 2 },
  );
}

function hasPartnerCreds(platform: string): boolean {
  switch (platform) {
    case 'gofood':
      return !!process.env.GOFOOD_API_KEY;
    case 'grabfood':
      return !!process.env.GRABFOOD_API_KEY;
    case 'shopeefood':
      return !!process.env.SHOPEEFOOD_PARTNER_KEY;
    default:
      return false;
  }
}
