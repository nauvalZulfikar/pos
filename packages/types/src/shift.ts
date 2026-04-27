import { z } from 'zod';
import { Money, OutletId, TenantOwnedBase, UserId } from './common.js';
import { ShiftId } from './order.js';

export const ShiftStatus = z.enum(['open', 'closing', 'closed']);
export type ShiftStatus = z.infer<typeof ShiftStatus>;

export const Shift = TenantOwnedBase.extend({
  id: ShiftId,
  outletId: OutletId,
  openedBy: UserId,
  closedBy: UserId.nullable(),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable(),
  startingCash: Money,
  expectedCash: Money.nullable(),
  countedCash: Money.nullable(),
  cashVariance: z.bigint().nullable(),
  totalSales: Money.default(BigInt(0)),
  totalOrders: z.number().int().nonnegative().default(0),
  status: ShiftStatus,
  closingNotes: z.string().max(1000).nullable(),
});
export type Shift = z.infer<typeof Shift>;

export const OpenShiftInput = z.object({
  outletId: OutletId,
  startingCash: Money,
});
export type OpenShiftInput = z.infer<typeof OpenShiftInput>;

export const CloseShiftInput = z.object({
  shiftId: ShiftId,
  countedCash: Money,
  notes: z.string().max(1000).nullable().optional(),
});
export type CloseShiftInput = z.infer<typeof CloseShiftInput>;
