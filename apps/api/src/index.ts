import { serve } from '@hono/node-server';
import { buildApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';

// JSON.stringify can't natively serialize BigInt. We store money as bigint sen
// (AGENTS.md §27.2) so every API response touches one. Serializing as a JSON
// string preserves precision in transit; clients parse with BigInt() at consume.
(BigInt.prototype as { toJSON?: () => string }).toJSON = function () {
  return this.toString();
};

const app = buildApp();
const cfg = env();

serve({ fetch: app.fetch, port: cfg.API_PORT }, (info) => {
  logger.info({ port: info.port }, 'desain-api listening');
});
