/**
 * Worker: deduct ingredient stock when an order moves to paid status.
 *
 * Triggered by enqueueing a job with `{ tenantId, outletId, orderId, performedBy }`
 * after `payments` table records a settled payment for the order.
 *
 * Idempotent via the BullMQ `jobId` of `recipe-deduct:<orderId>`.
 */

import { Worker } from 'bullmq';
import { and, db, eq, schema, sql } from '@desain/db';
import { planRecipeDeductions } from '@desain/domain';
import type { RecipeInput } from '@desain/domain';
import { uuidv7 } from 'uuidv7';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

type RecipeDeductJobData = {
  tenantId: string;
  outletId: string;
  orderId: string;
  performedBy: string;
};

export function startRecipeDeductWorker() {
  return new Worker<RecipeDeductJobData>(
    QueueName.recipeDeduct,
    async (job) => {
      const { tenantId, outletId, orderId, performedBy } = job.data;
      logger.debug({ tenantId, outletId, orderId }, 'recipe-deduct processing');

      // 1. Load order items
      const items = await db.query.orderItems.findMany({
        where: and(
          eq(schema.orderItems.tenantId, tenantId),
          eq(schema.orderItems.orderId, orderId),
        ),
      });
      if (items.length === 0) {
        logger.warn({ orderId }, 'recipe-deduct: order has no items, nothing to do');
        return { ok: true, deltas: 0 };
      }

      // 2. Load recipes for the menu items in this order
      const menuItemIds = [...new Set(items.filter((i) => i.status !== 'voided').map((i) => i.menuItemId))];
      const recipeRows = menuItemIds.length === 0
        ? []
        : await db.query.recipes.findMany({
            where: and(
              eq(schema.recipes.tenantId, tenantId),
            ),
          });
      const recipeMap = new Map<string, RecipeInput & { autoDeduct: boolean }>();
      for (const r of recipeRows) {
        if (!menuItemIds.includes(r.menuItemId)) continue;
        recipeMap.set(r.menuItemId, {
          autoDeduct: r.autoDeduct,
          ingredients: (r.ingredients as Array<{ inventoryItemId: string; quantityMilli: string | number | bigint }>).map((ing) => ({
            inventoryItemId: ing.inventoryItemId,
            quantityMilli: BigInt(ing.quantityMilli as string),
          })),
        });
      }

      // 3. Plan deductions
      const plan = planRecipeDeductions({
        lines: items
          .filter((i) => i.status !== 'voided')
          .map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        recipesByMenuItemId: recipeMap,
      });

      if (plan.deltas.length === 0) {
        logger.info({ orderId, skipped: plan.skippedMenuItems.length }, 'recipe-deduct: no deltas');
        return { ok: true, deltas: 0 };
      }

      // 4. Apply each delta in a single transaction
      await db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.current_tenant_id', ${tenantId}, true)`);
        await tx.execute(sql`select set_config('app.current_user_id', ${performedBy}, true)`);
        await tx.execute(sql`select set_config('app.current_outlet_id', ${outletId}, true)`);

        for (const d of plan.deltas) {
          await tx.insert(schema.stockMovements).values({
            id: uuidv7(),
            tenantId,
            outletId,
            inventoryItemId: d.inventoryItemId,
            type: 'sale_deduction',
            deltaMilli: d.deltaMilli,
            reason: `Order ${orderId}`,
            reference: orderId,
            performedBy,
          });

          // Upsert stock_levels.
          const existing = await tx.query.stockLevels.findFirst({
            where: and(
              eq(schema.stockLevels.tenantId, tenantId),
              eq(schema.stockLevels.outletId, outletId),
              eq(schema.stockLevels.inventoryItemId, d.inventoryItemId),
            ),
          });
          if (existing) {
            await tx
              .update(schema.stockLevels)
              .set({
                quantityMilli: existing.quantityMilli + d.deltaMilli,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(schema.stockLevels.tenantId, tenantId),
                  eq(schema.stockLevels.outletId, outletId),
                  eq(schema.stockLevels.inventoryItemId, d.inventoryItemId),
                ),
              );
          } else {
            await tx.insert(schema.stockLevels).values({
              tenantId,
              outletId,
              inventoryItemId: d.inventoryItemId,
              quantityMilli: d.deltaMilli,
              reorderThresholdMilli: null,
            });
          }
        }
      });

      logger.info(
        { orderId, deltas: plan.deltas.length, skipped: plan.skippedMenuItems.length },
        'recipe-deduct done',
      );
      return { ok: true, deltas: plan.deltas.length };
    },
    { connection, concurrency: 4 },
  );
}
