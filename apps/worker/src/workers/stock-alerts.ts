/**
 * Worker: daily stock alert check.
 * Runs at 06:00 WIB (per tenant), checks every (outlet, item) where reorder_threshold
 * is set and current stock falls below. Pushes WhatsApp + in-app notification.
 */

import { Worker } from 'bullmq';
import { db, eq, schema, and, lt, isNotNull } from '@desain/db';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

export function startStockAlertsWorker() {
  return new Worker(
    QueueName.stockAlerts,
    async (job) => {
      const { tenantId } = job.data as { tenantId: string };
      logger.debug({ tenantId }, 'stock-alerts processing');

      // Find low-stock items per (outlet, item) where reorder_threshold is set.
      const lowRows = await db
        .select({
          outletId: schema.stockLevels.outletId,
          inventoryItemId: schema.stockLevels.inventoryItemId,
          quantityMilli: schema.stockLevels.quantityMilli,
          thresholdMilli: schema.stockLevels.reorderThresholdMilli,
        })
        .from(schema.stockLevels)
        .where(
          and(
            eq(schema.stockLevels.tenantId, tenantId),
            isNotNull(schema.stockLevels.reorderThresholdMilli),
            lt(schema.stockLevels.quantityMilli, schema.stockLevels.reorderThresholdMilli),
          ),
        );

      if (lowRows.length === 0) {
        return { ok: true, alerts: 0 };
      }

      // Resolve item names + outlet names for the message
      const itemIds = [...new Set(lowRows.map((r) => r.inventoryItemId))];
      const outletIds = [...new Set(lowRows.map((r) => r.outletId))];
      const items = await Promise.all(
        itemIds.map((id) =>
          db.query.inventoryItems.findFirst({ where: eq(schema.inventoryItems.id, id) }),
        ),
      );
      const outlets = await Promise.all(
        outletIds.map((id) => db.query.outlets.findFirst({ where: eq(schema.outlets.id, id) })),
      );
      const itemMap = new Map(items.filter(Boolean).map((i) => [i!.id, i!]));
      const outletMap = new Map(outlets.filter(Boolean).map((o) => [o!.id, o!]));

      logger.info(
        { tenantId, alerts: lowRows.length },
        'stock-alerts: items below threshold',
      );

      // TODO: enqueue WhatsApp template send per outlet manager
      // For now, log + return summary
      const summary = lowRows.map((r) => ({
        outlet: outletMap.get(r.outletId)?.name ?? r.outletId,
        item: itemMap.get(r.inventoryItemId)?.name ?? r.inventoryItemId,
        currentQty: Number(r.quantityMilli) / 1000,
        thresholdQty: Number(r.thresholdMilli ?? 0n) / 1000,
      }));

      return { ok: true, alerts: summary.length, summary };
    },
    { connection, concurrency: 2 },
  );
}
