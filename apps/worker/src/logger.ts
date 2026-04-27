import pino from 'pino';

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'desain-worker' },
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});
