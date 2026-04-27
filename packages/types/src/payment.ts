import { z } from 'zod';
import { Money, OutletId, TenantOwnedBase, UserId, UuidV7 } from './common.js';
import { OrderId } from './order.js';

export const PaymentId = UuidV7.brand<'PaymentId'>();
export type PaymentId = z.infer<typeof PaymentId>;

export const PaymentMethod = z.enum([
  'cash',
  'qris',
  'gopay',
  'ovo',
  'dana',
  'shopeepay',
  'card_edc',
  'bank_transfer',
  'voucher',
  'other',
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentStatus = z.enum([
  'pending',
  'awaiting_settlement',
  'settled',
  'failed',
  'refunded',
  'partially_refunded',
  'cancelled',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PaymentProvider = z.enum(['midtrans', 'xendit', 'manual']);
export type PaymentProvider = z.infer<typeof PaymentProvider>;

export const Payment = TenantOwnedBase.extend({
  id: PaymentId,
  orderId: OrderId,
  outletId: OutletId,
  method: PaymentMethod,
  provider: PaymentProvider,
  /** External payment intent / charge id from the provider. */
  providerRef: z.string().max(200).nullable(),
  amount: Money,
  /** Amount returned to customer (e.g., cash overpayment). */
  changeReturned: Money.default(BigInt(0)),
  /** For QRIS: the rendered QR string. */
  qrPayload: z.string().max(2000).nullable(),
  /** Provider-side fee (informational, sourced from reconciliation). */
  providerFee: z.bigint().nullable(),
  status: PaymentStatus,
  receivedAt: z.string().datetime().nullable(),
  settledAt: z.string().datetime().nullable(),
  recordedBy: UserId,
  notes: z.string().max(500).nullable(),
});
export type Payment = z.infer<typeof Payment>;

export const CreatePaymentIntentInput = z.object({
  orderId: OrderId,
  method: PaymentMethod,
  amount: Money,
  /** For cash: how much was tendered, used to compute change. */
  tendered: Money.optional(),
  notes: z.string().max(500).nullable().optional(),
});
export type CreatePaymentIntentInput = z.infer<typeof CreatePaymentIntentInput>;

export const RefundInput = z.object({
  paymentId: PaymentId,
  amount: Money,
  reason: z.string().min(1).max(500),
});
export type RefundInput = z.infer<typeof RefundInput>;
