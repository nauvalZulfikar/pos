/**
 * Hono request-scoped context. Variables set by middleware are typed here.
 */

import type { FeatureMap } from '@desain/domain';
import type { Permission, Role } from '@desain/types';
import type { Context } from 'hono';

export type AuthIdentity = {
  userId: string;
  tenantId: string;
  outletId: string | null;
  deviceId: string | null;
  role: Role;
  permissions: Set<Permission>;
  sessionId: string;
};

export type RequestVars = {
  requestId: string;
  identity: AuthIdentity;
  features: FeatureMap;
};

export type AppContext = Context<{ Variables: RequestVars }>;
