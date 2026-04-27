/**
 * Receipt rendering API. Returns either a plain text receipt body or
 * the ESC/POS byte stream the terminal can pipe to a thermal printer.
 */

import { and, db, eq, schema } from '@desain/db';
import { renderReceiptText, textToEscPos } from '@desain/domain';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import type { RequestVars } from '../context.js';

export const receiptRouter = new Hono<{ Variables: RequestVars }>();

receiptRouter.use('*', authRequired, tenantContext);

async function loadReceiptInput(tenantId: string, orderId: string, paperWidth: number) {
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  const items = await db.query.orderItems.findMany({
    where: and(
      eq(schema.orderItems.tenantId, tenantId),
      eq(schema.orderItems.orderId, orderId),
    ),
  });
  const payments = await db.query.payments.findMany({
    where: and(
      eq(schema.payments.tenantId, tenantId),
      eq(schema.payments.orderId, orderId),
    ),
  });
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, tenantId),
  });
  const outlet = await db.query.outlets.findFirst({
    where: eq(schema.outlets.id, order.outletId),
  });
  if (!tenant || !outlet) throw new ProblemError(500, 'INTERNAL', 'Tenant/outlet missing');

  // Resolve kasir name
  let kasirName = 'Kasir';
  if (payments.length > 0 && payments[0]) {
    const kasirUser = await db.query.users.findFirst({
      where: eq(schema.users.id, payments[0].recordedBy),
    });
    if (kasirUser) kasirName = kasirUser.fullName;
  }

  return {
    tenant: {
      displayName: tenant.displayName,
      npwp: tenant.npwp,
      isPkp: tenant.isPkp,
    },
    outlet: {
      name: outlet.name,
      addressLine1: outlet.addressLine1,
      addressLine2: outlet.addressLine2,
      city: outlet.city,
      phone: outlet.phone,
    },
    order: {
      outletOrderNumber: order.outletOrderNumber,
      items: items.map((it) => ({
        itemNameSnapshot: it.itemNameSnapshot,
        quantity: it.quantity,
        modifiers: (it.modifiers as { name: string }[]) ?? [],
        notes: it.notes,
        status: it.status,
        lineSubtotal: it.lineSubtotal,
      })),
      subtotal: order.subtotal,
      discountTotal: order.discountTotal,
      serviceCharge: order.serviceCharge,
      ppnTotal: order.ppnTotal,
      rounding: order.rounding,
      total: order.total,
      createdAt: order.createdAt.toISOString(),
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      customerName: order.customerName,
    },
    kasirName,
    payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
    paperWidthChars: paperWidth,
  };
}

receiptRouter.get('/:id/text', async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const width = Number(c.req.query('width') ?? '32');
  const input = await loadReceiptInput(id.tenantId, orderId, width);
  const text = renderReceiptText(input);
  return c.text(text);
});

receiptRouter.get('/:id/escpos', async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');
  const width = Number(c.req.query('width') ?? '32');
  const input = await loadReceiptInput(id.tenantId, orderId, width);
  const text = renderReceiptText(input);
  const bytes = textToEscPos(text);
  // Uint8Array is a valid response body at runtime; cast keeps tsc happy.
  return new Response(bytes as unknown as ReadableStream<Uint8Array>, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="receipt-${orderId}.escpos"`,
    },
  });
});
