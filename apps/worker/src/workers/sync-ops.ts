/**
 * Worker: process sync.ops jobs.
 * Materializes side-effects (KDS push, integration sync) AFTER the API has
 * already persisted the op idempotently.
 */

import { Worker } from 'bullmq';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

export function startSyncOpsWorker() {
  return new Worker(
    QueueName.syncOps,
    async (job) => {
      logger.debug({ jobId: job.id, name: job.name }, 'sync.ops processing');
      // TODO: dispatch by op type:
      //  - order.create     → push to KDS via Socket.io broadcast
      //  - payment.record   → trigger receipt generation
      //  - shift.close      → recompute totals + dispatch reconciliation
      return { ok: true };
    },
    { connection, concurrency: 4 },
  );
}
