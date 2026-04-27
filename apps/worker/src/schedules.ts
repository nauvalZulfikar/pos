/**
 * Repeatable jobs. AGENTS.md §20.3.
 *
 * Per-tenant schedules (daily brief at owner's hour) are added dynamically when
 * the tenant enables the relevant feature.
 */

import { queues } from './queues.js';
import { logger } from './logger.js';

export async function ensureSchedules(): Promise<void> {
  // Nightly aggregation kickoff at 00:30 Asia/Jakarta = 17:30 UTC.
  await queues.aiDailyBrief.add(
    'aggregate',
    { kind: 'aggregate' },
    {
      repeat: { pattern: '30 17 * * *', tz: 'UTC' },
      jobId: 'cron:daily-brief:aggregate',
    },
  );

  // Weekly menu performance scoring on Mondays at 02:00 UTC.
  await queues.aiMenuScore.add(
    'weekly',
    { kind: 'weekly' },
    {
      repeat: { pattern: '0 2 * * 1', tz: 'UTC' },
      jobId: 'cron:menu-score:weekly',
    },
  );

  // Nightly Midtrans reconciliation at 18:00 UTC (= 01:00 Jakarta).
  await queues.paymentReconcile.add(
    'midtrans',
    { provider: 'midtrans' },
    {
      repeat: { pattern: '0 18 * * *', tz: 'UTC' },
      jobId: 'cron:recon:midtrans',
    },
  );

  logger.info('schedules ensured');
}
