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
  deliverySync: 'delivery.outbound.sync',
  aiMenuScore: 'ai.menu_score',
  demandForecast: 'analytics.demand_forecast',
} as const;

const recipeDeductQueue = new Queue(QueueNames.recipeDeduct, { connection: redis });
const deliverySyncQueue = new Queue(QueueNames.deliverySync, { connection: redis });
const menuScoreQueue = new Queue(QueueNames.aiMenuScore, { connection: redis });
const demandForecastQueue = new Queue(QueueNames.demandForecast, { connection: redis });

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

export async function enqueueDeliverySync(tenantId: string, linkId?: string): Promise<void> {
  await deliverySyncQueue.add(
    'sync',
    { tenantId, linkId },
    {
      jobId: `delivery-sync:${tenantId}:${linkId ?? 'all'}:${Date.now()}`,
      removeOnComplete: 50,
      removeOnFail: 50,
      attempts: 2,
    },
  );
}

export async function enqueueMenuScore(tenantId: string): Promise<void> {
  await menuScoreQueue.add(
    'tenant',
    { kind: 'tenant', tenantId },
    {
      jobId: `menu-score:${tenantId}:${Date.now()}`,
      removeOnComplete: 20,
      removeOnFail: 20,
    },
  );
}

export async function enqueueDemandForecast(tenantId: string): Promise<void> {
  await demandForecastQueue.add(
    'tenant',
    { kind: 'tenant', tenantId },
    {
      jobId: `demand-forecast:${tenantId}:${Date.now()}`,
      removeOnComplete: 20,
      removeOnFail: 20,
    },
  );
}
