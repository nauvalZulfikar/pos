/**
 * Integration test — exercises the Hono app without a real DB.
 * Env defaults are set by vitest.setup.ts (loaded before imports).
 */

import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const app = buildApp();

describe('app routing', () => {
  it('GET /healthz returns 200 with ok payload', async () => {
    const res = await app.fetch(new Request('http://x/healthz'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('GET /unknown returns 404', async () => {
    const res = await app.fetch(new Request('http://x/this-does-not-exist'));
    expect(res.status).toBe(404);
  });

  it('CORS preflight responds with allowed methods', async () => {
    const res = await app.fetch(
      new Request('http://x/v1/menu/items', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://localhost:5173',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'authorization',
        },
      }),
    );
    expect([200, 204]).toContain(res.status);
  });

  it('protected route returns 401 without auth', async () => {
    const res = await app.fetch(new Request('http://x/v1/menu/items'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect((body as { code: string }).code).toBe('AUTH_REQUIRED');
  });

  it('returns RFC 7807 problem details on auth fail', async () => {
    const res = await app.fetch(new Request('http://x/v1/menu/items'));
    const body = (await res.json()) as { type: string; status: number; code: string };
    expect(body.type).toMatch(/^https?:\/\//);
    expect(body.status).toBe(401);
    expect(body.code).toBeTruthy();
  });

  it('attaches request id header to every response', async () => {
    const res = await app.fetch(new Request('http://x/healthz'));
    expect(res.headers.get('x-request-id')).toBeTruthy();
  });

  it('echoes incoming x-request-id when present', async () => {
    const res = await app.fetch(
      new Request('http://x/healthz', { headers: { 'x-request-id': 'test-rid-123' } }),
    );
    expect(res.headers.get('x-request-id')).toBe('test-rid-123');
  });
});

describe('env validation', () => {
  it('env() returns parsed config', async () => {
    const { env } = await import('./env.js');
    const cfg = env();
    expect(cfg.NODE_ENV).toBe('test');
    expect(cfg.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(cfg.TERMINAL_TOKEN_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
