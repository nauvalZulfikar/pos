import type { MiddlewareHandler } from 'hono';
import { uuidv7 } from 'uuidv7';
import type { RequestVars } from '../context.js';

export const requestId: MiddlewareHandler<{ Variables: RequestVars }> = async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming && incoming.length <= 80 ? incoming : uuidv7();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};
