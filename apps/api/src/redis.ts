import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env().REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  // Lazy connect so importing this module in tests doesn't trigger retry storms.
  lazyConnect: true,
});

/** Per-tenant key prefix. AGENTS.md §7.5. */
export function tenantKey(tenantId: string, ...parts: string[]): string {
  return ['t', tenantId, ...parts].join(':');
}
