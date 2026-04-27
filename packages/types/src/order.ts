import { z } from 'zod';
import { Money, OutletId, TenantOwnedBase, UserId, UuidV7 } from './common.js';
import { MenuItemId, ModifierId, PricingProfile } from './menu.js';

export const OrderId = UuidV7.brand<'OrderId'>();
export type OrderId = z.infer<typeof OrderId>;

export const OrderItemId = UuidV7.brand<'OrderItemId'>();
export type OrderItemId = z.infer<typeof OrderItemId>;

export const ShiftId = UuidV7.brand<'ShiftId'>();
export type ShiftId = z.infer<typeof ShiftId>;

export const TableId = UuidV7.brand<'TableId'>();
export type TableId = z.infer<typeof TableId>;

export const OrderStatus = z.enum([
  'open',
  'sent_to_kitchen',
  'ready',
  'served',
  'paid',
  'voided',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderSource = z.enum([
  'pos_dine_in',
  'pos_take_away',
  'gofood',
  'grabfood',
  'shopeefood',
  'whatsapp',
  'web',
]);
export type OrderSource = z.infer<typeof OrderSource>;

export const OrderItemStatus = z.enum(['queued', 'preparing', 'ready', 'served', 'voided']);
export type OrderItemStatus = z.infer<typeof OrderItemStatus>;

export const SelectedModifier = z.object({
  modifierId: ModifierId,
  name: z.string(),
  priceDelta: z.bigint(),
});
export type SelectedModifier = z.infer<typeof SelectedModifier>;

export const OrderItem = z.object({
  id: OrderItemId,
  orderId: OrderId,
  menuItemId: MenuItemId,
  /** Snapshot of menu item name at time of order. Survives menu rename. */
  itemNameSnapshot: z.string(),
  unitPrice: Money,
  quantity: z.number().int().positive(),
  modifiers: z.array(SelectedModifier),
  modifiersTotal: z.bigint(),
  /** Computed: (unitPrice + modifiersTotal) × quantity, before discount. */
  lineSubtotal: Money,
  notes: z.string().max(500).nullable(),
  status: OrderItemStatus,
  /** Per-item PPN bps snapshot. */
  ppnBpsSnapshot: z.number().int().min(0).max(2500),
  voidReason: z.string().max(200).nullable(),
  voidedBy: UserId.nullable(),
  voidedAt: z.string().datetime().nullable(),
});
export type OrderItem = z.infer<typeof OrderItem>;

export const OrderDiscount = z.object({
  type: z.enum(['percent', 'amount']),
  value: z.bigint(),
  reason: z.string().max(200),
  appliedBy: UserId,
  appliedAt: z.string().datetime(),
});
export type OrderDiscount = z.infer<typeof OrderDiscount>;

export const Order = TenantOwnedBase.extend({
  id: OrderId,
  outletId: OutletId,
  shiftId: ShiftId.nullable(),
  tableId: TableId.nullable(),
  /** Sequential per-outlet per-business-day. Display number, not the id. */
  outletOrderNumber: z.string().regex(/^\d{4,6}$/),
  source: OrderSource,
  pricingProfile: PricingProfile,
  status: OrderStatus,
  customerName: z.string().max(120).nullable(),
  customerPhone: z.string().max(20).nullable(),
  guestCount: z.number().int().nonnegative().nullable(),
  items: z.array(OrderItem),
  discounts: z.array(OrderDiscount),
  subtotal: Money,
  discountTotal: z.bigint(),
  serviceCharge: Money,
  ppnTotal: Money,
  rounding: z.bigint(),
  total: Money,
  notes: z.string().max(500).nullable(),
  /** Set when status moves to paid. */
  paidAt: z.string().datetime().nullable(),
  /** Aggregator-side ID for delivery orders. */
  externalOrderId: z.string().max(120).nullable(),
});
export type Order = z.infer<typeof Order>;

export const CreateOrderInput = z.object({
  outletId: OutletId,
  shiftId: ShiftId.nullable(),
  tableId: TableId.nullable(),
  source: OrderSource,
  pricingProfile: PricingProfile.default('dine_in'),
  customerName: z.string().max(120).nullable().optional(),
  customerPhone: z.string().max(20).nullable().optional(),
  guestCount: z.number().int().nonnegative().nullable().optional(),
  items: z.array(
    z.object({
      menuItemId: MenuItemId,
      quantity: z.number().int().positive(),
      modifiers: z.array(z.object({ modifierId: ModifierId })).default([]),
      notes: z.string().max(500).nullable().optional(),
    }),
  ),
  notes: z.string().max(500).nullable().optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
