import { PermissionDeniedError } from '@desain/types';
import type { Permission } from '@desain/types';
import type { MiddlewareHandler } from 'hono';
import type { RequestVars } from '../context.js';

export function requirePermission(permission: Permission): MiddlewareHandler<{ Variables: RequestVars }> {
  return async (c, next) => {
    const id = c.get('identity');
    if (!id || !id.permissions.has(permission)) {
      throw new PermissionDeniedError(permission);
    }
    await next();
  };
}
