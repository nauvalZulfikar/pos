/**
 * Queue definitions. AGENTS.md §20.1.
 */

import { Queue } from 'bullmq';
import { connection } from './redis.js';

export const QueueName = {
  syncOps: 'sync.ops',
  deliveryInbound: 'delivery.inbound',
  deliveryOutbound: 'delivery.outbound',
  paymentReconcile: 'payment.reconcile',
  notificationsWhatsapp: 'notifications.whatsapp',
  aiDailyBrief: 'ai.daily_brief',
  aiMenuScore: 'ai.menu_score',
  aiAnomalyDetection: 'ai.anomaly',
  reportsExport: 'reports.export',
  recipeDeduct: 'recipe.deduct',
  stockAlerts: 'stock.alerts',
  peakHour: 'analytics.peak_hour',
} as const;

export const queues = {
  syncOps: new Queue(QueueName.syncOps, { connection }),
  deliveryInbound: new Queue(QueueName.deliveryInbound, { connection }),
  deliveryOutbound: new Queue(QueueName.deliveryOutbound, { connection }),
  paymentReconcile: new Queue(QueueName.paymentReconcile, { connection }),
  notificationsWhatsapp: new Queue(QueueName.notificationsWhatsapp, { connection }),
  aiDailyBrief: new Queue(QueueName.aiDailyBrief, { connection }),
  aiMenuScore: new Queue(QueueName.aiMenuScore, { connection }),
  aiAnomalyDetection: new Queue(QueueName.aiAnomalyDetection, { connection }),
  reportsExport: new Queue(QueueName.reportsExport, { connection }),
  recipeDeduct: new Queue(QueueName.recipeDeduct, { connection }),
  stockAlerts: new Queue(QueueName.stockAlerts, { connection }),
  peakHour: new Queue(QueueName.peakHour, { connection }),
} as const;

export type QueueId = keyof typeof queues;
