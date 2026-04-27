import { Worker } from 'bullmq';
import { connection } from '../redis.js';
import { logger } from '../logger.js';
import { QueueName } from '../queues.js';

export function startWhatsappWorker() {
  return new Worker(
    QueueName.notificationsWhatsapp,
    async (job) => {
      logger.debug({ jobId: job.id }, 'notifications.whatsapp processing');
      // TODO: send template via WhatsAppProvider; respect Meta rate limits.
      return { ok: true };
    },
    { connection, concurrency: 4 },
  );
}
