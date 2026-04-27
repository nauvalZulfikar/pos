import { logger } from './logger.js';
import { ensureSchedules } from './schedules.js';
import { startSyncOpsWorker } from './workers/sync-ops.js';
import { startDeliveryInboundWorker } from './workers/delivery-inbound.js';
import { startDailyBriefWorker } from './workers/daily-brief.js';
import { startWhatsappWorker } from './workers/whatsapp.js';
import { startRecipeDeductWorker } from './workers/recipe-deduct.js';
import { startStockAlertsWorker } from './workers/stock-alerts.js';
import { startAnomalyWorker } from './workers/anomaly.js';

async function bootstrap() {
  const workers = [
    startSyncOpsWorker(),
    startDeliveryInboundWorker(),
    startDailyBriefWorker(),
    startWhatsappWorker(),
    startRecipeDeductWorker(),
    startStockAlertsWorker(),
    startAnomalyWorker(),
  ];

  await ensureSchedules();

  logger.info({ workerCount: workers.length }, 'desain-worker started');

  for (const w of workers) {
    w.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'job failed');
    });
  }

  const shutdown = async () => {
    logger.info('shutting down…');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  logger.fatal({ err }, 'worker failed to start');
  process.exit(1);
});
