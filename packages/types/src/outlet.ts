import { z } from 'zod';
import { OutletId, TenantOwnedBase } from './common.js';

export const Outlet = TenantOwnedBase.extend({
  id: OutletId,
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20),
  addressLine1: z.string().max(200),
  addressLine2: z.string().max(200).nullable(),
  city: z.string().max(80),
  province: z.string().max(80),
  postalCode: z.string().max(10).nullable(),
  phone: z.string().max(20).nullable(),
  /** PPN rate override at outlet level (rare; defaults to tenant). 1100 = 11.00%. */
  ppnBpsOverride: z.number().int().min(0).max(2500).nullable(),
  serviceChargeBps: z.number().int().min(0).max(2500).default(0),
  /** 04:00 default; can override tenant. */
  businessDayBoundary: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  isActive: z.boolean(),
});
export type Outlet = z.infer<typeof Outlet>;

export const CreateOutletInput = Outlet.pick({
  name: true,
  code: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  province: true,
  postalCode: true,
  phone: true,
});
export type CreateOutletInput = z.infer<typeof CreateOutletInput>;
