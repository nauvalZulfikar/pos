import Redis from 'ioredis';

const url = process.env.REDIS_URL;
if (!url) throw new Error('REDIS_URL must be set');

export const connection = new Redis(url, {
  maxRetriesPerRequest: null, // BullMQ requires this
  enableReadyCheck: false,
});
