import { z } from 'zod';
import { TenantId, Timestamp } from './common.js';

export const TenantSegment = z.enum(['warung', 'cafe', 'multi_cabang', 'chain']);
export type TenantSegment = z.infer<typeof TenantSegment>;

export const Tenant = z.object({
  id: TenantId,
  legalName: z.string().min(1).max(200),
  displayName: z.string().min(1).max(120),
  npwp: z.string().regex(/^\d{15,16}$/).nullable(),
  isPkp: z.boolean(),
  segment: TenantSegment,
  defaultLocale: z.enum(['id-ID', 'en-US']).default('id-ID'),
  defaultTimezone: z.string().default('Asia/Jakarta'),
  /** 04:00 Asia/Jakarta default — late-night closing covered. Stored as HH:mm. */
  businessDayBoundary: z.string().regex(/^\d{2}:\d{2}$/).default('04:00'),
  status: z.enum(['active', 'suspended', 'churned']),
  createdAt: Timestamp,
  updatedAt: Timestamp,
});
export type Tenant = z.infer<typeof Tenant>;

export const CreateTenantInput = Tenant.pick({
  legalName: true,
  displayName: true,
  npwp: true,
  isPkp: true,
  segment: true,
}).extend({
  ownerEmail: z.string().email(),
  ownerName: z.string().min(1).max(120),
  ownerPhone: z.string().regex(/^\+?\d{8,15}$/),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInput>;
