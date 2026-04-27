import { ProblemError } from '@desain/types';
import type { MiddlewareHandler } from 'hono';
import { redis, tenantKey } from '../redis.js';
import type { RequestVars } from '../context.js';

export type RateLimitOpts = {
  /** Window in seconds. */
  windowSec: number;
  /** Allowed requests per window. */
  max: number;
  /** Optional key suffix differentiator. */
  bucket?: string;
};

export function rateLimit(opts: RateLimitOpts): MiddlewareHandler<{ Variables: RequestVars }> {
  return async (c, next) => {
    const id = c.get('identity');
    const tenantId = id?.tenantId ?? 'anon';
    const key = tenantKey(
      tenantId,
      'rl',
      opts.bucket ?? c.req.routePath ?? 'global',
      id?.userId ?? c.req.header('x-forwarded-for') ?? 'anon',
    );

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, opts.windowSec);

    if (count > opts.max) {
      const ttl = await redis.ttl(key);
      c.header('retry-after', String(Math.max(1, ttl)));
      throw new ProblemError(429, 'RATE_LIMITED', `Rate limit exceeded (${opts.max}/${opts.windowSec}s).`, {
        retryAfterSec: Math.max(1, ttl),
      });
    }
    await next();
  };
}
