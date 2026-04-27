import { z } from 'zod';
import { DeviceId, OutletId, TenantId, UserId, UuidV7 } from './common.js';
import { ShiftId } from './order.js';

export const OpType = z.enum([
  'order.create',
  'order.add_item',
  'order.update_item',
  'order.void_item',
  'order.apply_discount',
  'order.update',
  'order.send_to_kitchen',
  'order.cancel',
  'order.close',
  'payment.record',
  'payment.refund',
  'shift.open',
  'shift.close',
  'shift.cash_count',
  'inventory.adjust',
  'customer.upsert',
  'table.update_status',
]);
export type OpType = z.infer<typeof OpType>;

export const Op = z.object({
  clientOpId: UuidV7,
  tenantId: TenantId,
  outletId: OutletId,
  shiftId: ShiftId.nullable(),
  userId: UserId,
  deviceId: DeviceId,
  type: OpType,
  payload: z.unknown(),
  /** Client clock at op creation. Authoritative for receipt; not for ordering. */
  clientAt: z.string().datetime(),
});
export type Op = z.infer<typeof Op>;

export const OpResult = z.discriminatedUnion('status', [
  z.object({
    clientOpId: UuidV7,
    status: z.literal('applied'),
    receivedAt: z.string().datetime(),
    /** Server-canonical row(s) to upsert into client cache. */
    canonical: z.array(
      z.object({
        kind: z.string(),
        row: z.record(z.unknown()),
      }),
    ),
  }),
  z.object({
    clientOpId: UuidV7,
    status: z.literal('duplicate'),
    receivedAt: z.string().datetime(),
  }),
  z.object({
    clientOpId: UuidV7,
    status: z.literal('rejected'),
    code: z.string(),
    detail: z.string(),
  }),
]);
export type OpResult = z.infer<typeof OpResult>;

export const SyncBatch = z.object({
  ops: z.array(Op).min(1).max(500),
  /** Optional: set if the client wants the server to validate its current shift cursor. */
  shiftCursor: z
    .object({
      shiftId: ShiftId,
      lastAckedClientOpId: UuidV7.nullable(),
    })
    .nullable()
    .optional(),
});
export type SyncBatch = z.infer<typeof SyncBatch>;

export const SyncResponse = z.object({
  results: z.array(OpResult),
  serverNow: z.string().datetime(),
});
export type SyncResponse = z.infer<typeof SyncResponse>;
