import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env().NODE_ENV === 'production' ? 'info' : 'debug',
  base: { service: 'desain-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'pin',
      'pinHash',
      'passwordHash',
      'customerPhone',
    ],
    remove: true,
  },
  ...(env().NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});

export type Logger = typeof logger;
