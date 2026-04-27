/**
 * Lightweight enqueue helpers — the API publishes BullMQ jobs that the worker
 * service consumes. We don't import the worker package to avoid a circular dep.
 */

import { Queue } from 'bullmq';
import { redis } from './redis.js';

const QueueNames = {
  recipeDeduct: 'recipe.deduct',
  notificationsWhatsapp: 'notifications.whatsapp',
  deliveryInbound: 'delivery.inbound',
} as const;

const recipeDeductQueue = new Queue(QueueNames.recipeDeduct, { connection: redis });

export type RecipeDeductJob = {
  tenantId: string;
  outletId: string;
  orderId: string;
  performedBy: string;
};

export async function enqueueRecipeDeduct(data: RecipeDeductJob): Promise<void> {
  // Idempotent jobId: one deduction per order, even if payment is retried.
  await recipeDeductQueue.add('deduct', data, {
    jobId: `recipe-deduct:${data.orderId}`,
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}
