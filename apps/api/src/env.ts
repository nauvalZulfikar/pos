import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3000),
  API_BASE_URL: z.string().url().default('http://localhost:3000'),
  API_CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:3001'),
  DATABASE_URL: z.string().min(1),
  DATABASE_ADMIN_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  TERMINAL_TOKEN_SECRET: z.string().min(32),
  ANTHROPIC_API_KEY: z.string().optional(),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_IS_PRODUCTION: z.coerce.boolean().default(false),
  MIDTRANS_WEBHOOK_SECRET: z.string().optional(),
  ML_SERVICE_URL: z.string().url().optional(),
  ML_SERVICE_JWT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  /** 32-byte hex (64 chars) AES-256-GCM key for at-rest PII encryption (phone, NPWP). */
  PII_ENCRYPTION_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let _cached: Env | null = null;

export function env(): Env {
  if (_cached) return _cached;
  _cached = EnvSchema.parse(process.env);
  return _cached;
}
