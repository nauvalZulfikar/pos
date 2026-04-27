/**
 * OpenAPI 3.1 spec generator. AGENTS.md §9.5.
 *
 * For now this is a placeholder; we'll wire `@hono/zod-openapi` properly
 * once the route surface stabilizes. Goal is to fail the build if Zod
 * schemas drift from the wire format.
 */

const spec = {
  openapi: '3.1.0',
  info: {
    title: 'DESAIN POS API',
    version: '0.0.1',
    description: 'Multi-tenant SaaS POS for Indonesian F&B.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  paths: {
    '/healthz': {
      get: { responses: { '200': { description: 'ok' } } },
    },
  },
};

process.stdout.write(JSON.stringify(spec, null, 2) + '\n');
