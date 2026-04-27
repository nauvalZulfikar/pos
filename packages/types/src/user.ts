import { z } from 'zod';
import { OutletId, TenantId, TenantOwnedBase, UserId } from './common.js';

export const Role = z.enum(['owner', 'manager', 'kasir', 'dapur']);
export type Role = z.infer<typeof Role>;

/** Granular per-outlet capabilities. AGENTS.md §11.4 */
export const Permission = z.enum([
  'order:create',
  'order:edit',
  'order:void',
  'order:apply_discount',
  'payment:record',
  'payment:refund',
  'menu:read',
  'menu:edit',
  'inventory:read',
  'inventory:adjust',
  'shift:open',
  'shift:close',
  'shift:cash_count',
  'reports:view',
  'reports:export',
  'settings:edit',
  'staff:manage',
]);
export type Permission = z.infer<typeof Permission>;

export const User = z.object({
  id: UserId,
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  phone: z.string().regex(/^\+?\d{8,15}$/).nullable(),
  /** PIN is stored hashed; never on the wire. Optional for managers/owners who use password. */
  hasPin: z.boolean(),
  isActive: z.boolean(),
  emailVerifiedAt: z.string().datetime().nullable(),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const Membership = TenantOwnedBase.extend({
  userId: UserId,
  tenantId: TenantId,
  role: Role,
  /** Per-outlet permission overrides. Empty = inherit role defaults. */
  outletPermissions: z.array(
    z.object({
      outletId: OutletId,
      permissions: z.array(Permission),
    }),
  ),
  isActive: z.boolean(),
});
export type Membership = z.infer<typeof Membership>;

/** PIN auth payload — kasir login on terminal. */
export const PinLoginInput = z.object({
  pin: z.string().regex(/^\d{4}$/),
  outletId: OutletId,
});
export type PinLoginInput = z.infer<typeof PinLoginInput>;

/** Default permission set per role. AGENTS.md §11. */
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: Permission.options,
  manager: [
    'order:create',
    'order:edit',
    'order:void',
    'order:apply_discount',
    'payment:record',
    'payment:refund',
    'menu:read',
    'menu:edit',
    'inventory:read',
    'inventory:adjust',
    'shift:open',
    'shift:close',
    'shift:cash_count',
    'reports:view',
    'reports:export',
    'staff:manage',
  ],
  kasir: [
    'order:create',
    'order:edit',
    'payment:record',
    'menu:read',
    'shift:open',
    'shift:close',
    'shift:cash_count',
  ],
  dapur: ['menu:read'],
} as const;
