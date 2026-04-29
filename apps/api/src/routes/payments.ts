import { eq, and, db, schema, sql } from '@desain/db';
import { payment as paymentInt } from '@desain/integrations';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import { idempotency } from '../middleware/idempotency.js';
import { enqueueRecipeDeduct } from '../queues.js';
import { env } from '../env.js';
import type { RequestVars } from '../context.js';

export const paymentRouter = new Hono<{ Variables: RequestVars }>();

paymentRouter.use('*', authRequired, tenantContext);

/**
 * Returns true (and marks the order paid) only if the sum of settled payments
 * for this order is >= the order total. Supports split-bill: multiple partial
 * payments converge to a paid order without mutating intermediate states.
 */
async function markPaidIfCovered(
  tenantId: string,
  orderId: string,
): Promise<{ paid: boolean; remaining: bigint }> {
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, tenantId)),
  });
  if (!order) return { paid: false, remaining: BigInt(0) };
  const settled = await db
    .select({ s: sql<string>`coalesce(sum(${schema.payments.amount}), 0)::text` })
    .from(schema.payments)
    .where(
      and(
        eq(schema.payments.tenantId, tenantId),
        eq(schema.payments.orderId, orderId),
        eq(schema.payments.status, 'settled'),
      ),
    );
  const sum = BigInt(settled[0]?.s ?? '0');
  const remaining = order.total - sum;
  if (sum >= order.total && order.status !== 'paid') {
    await db
      .update(schema.orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(eq(schema.orders.id, orderId));
    return { paid: true, remaining: BigInt(0) };
  }
  return { paid: order.status === 'paid', remaining };
}

const RecordCashInput = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.bigint(),
  tendered: z.coerce.bigint().optional(),
  notes: z.string().max(500).nullable().optional(),
});

paymentRouter.post(
  '/cash',
  requirePermission('payment:record'),
  idempotency,
  async (c) => {
    const id = c.get('identity');
    const input = RecordCashInput.parse(await c.req.json());
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.tenantId, id.tenantId)),
    });
    if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');

    const change =
      input.tendered && input.tendered > input.amount ? input.tendered - input.amount : BigInt(0);
    const paymentId = uuidv7();
    await db.insert(schema.payments).values({
      id: paymentId,
      tenantId: id.tenantId,
      orderId: order.id,
      outletId: order.outletId,
      method: 'cash',
      provider: 'manual',
      amount: input.amount,
      changeReturned: change,
      status: 'settled',
      receivedAt: new Date(),
      settledAt: new Date(),
      recordedBy: id.userId,
      notes: input.notes ?? null,
    });
    const status = await markPaidIfCovered(id.tenantId, order.id);
    const created = await db.query.payments.findFirst({ where: eq(schema.payments.id, paymentId) });
    if (status.paid) {
      await enqueueRecipeDeduct({
        tenantId: id.tenantId,
        outletId: order.outletId,
        orderId: order.id,
        performedBy: id.userId,
      });
    }
    return c.json(
      {
        payment: created,
        orderPaid: status.paid,
        remainingDue: status.remaining.toString(),
      },
      201,
    );
  },
);

const QrisIntentInput = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.bigint(),
  method: z.enum(['qris', 'gopay', 'ovo', 'dana', 'shopeepay']).default('qris'),
});

paymentRouter.post(
  '/qris/intent',
  requireFeatures(['qris_native']),
  requirePermission('payment:record'),
  idempotency,
  async (c) => {
    const id = c.get('identity');
    const input = QrisIntentInput.parse(await c.req.json());
    const order = await db.query.orders.findFirst({
      where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.tenantId, id.tenantId)),
    });
    if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');

    const cfg = env();
    const paymentId = uuidv7();
    let qrPayload: string;
    let providerRef: string;
    let expiresAt: string;

    if (cfg.MIDTRANS_SERVER_KEY) {
      const provider = new paymentInt.MidtransProvider({
        serverKey: cfg.MIDTRANS_SERVER_KEY,
        isProduction: cfg.MIDTRANS_IS_PRODUCTION,
      });
      try {
        const intent = await provider.createIntent({
          tenantId: id.tenantId,
          outletId: order.outletId,
          orderId: order.id,
          amount: input.amount as bigint as never,
          method: input.method,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
        });
        qrPayload = intent.qrPayload ?? intent.redirectUrl ?? 'MIDTRANS_NO_QR';
        providerRef = intent.providerRef;
        expiresAt = intent.expiresAt;
      } catch (err) {
        throw new ProblemError(
          502,
          'UPSTREAM_FAILED',
          err instanceof Error ? `Midtrans: ${err.message}` : 'Midtrans error',
        );
      }
    } else {
      qrPayload = `MOCK_QRIS:${paymentId}`;
      providerRef = `MOCK-${paymentId}`;
      expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    }

    await db.insert(schema.payments).values({
      id: paymentId,
      tenantId: id.tenantId,
      orderId: input.orderId,
      outletId: order.outletId,
      method: input.method,
      provider: cfg.MIDTRANS_SERVER_KEY ? 'midtrans' : 'manual',
      providerRef,
      amount: input.amount,
      qrPayload,
      status: 'pending',
      recordedBy: id.userId,
    });

    return c.json({
      paymentId,
      qrPayload,
      providerRef,
      expiresAt,
      mock: !cfg.MIDTRANS_SERVER_KEY,
    });
  },
);

paymentRouter.get('/by-order/:orderId', async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('orderId');
  const items = await db.query.payments.findMany({
    where: and(eq(schema.payments.orderId, orderId), eq(schema.payments.tenantId, id.tenantId)),
  });
  return c.json({ items });
});

paymentRouter.get('/:id', async (c) => {
  const id = c.get('identity');
  const paymentId = c.req.param('id');
  const payment = await db.query.payments.findFirst({
    where: and(eq(schema.payments.id, paymentId), eq(schema.payments.tenantId, id.tenantId)),
  });
  if (!payment) throw new ProblemError(404, 'NOT_FOUND', 'Payment not found');
  return c.json({ payment });
});

const MockSettleInput = z.object({ paymentId: z.string().uuid() });

paymentRouter.post('/qris/mock-settle', requirePermission('payment:record'), async (c) => {
  if (env().NODE_ENV === 'production') {
    throw new ProblemError(403, 'PERMISSION_DENIED', 'Mock settle disabled in production');
  }
  const id = c.get('identity');
  const input = MockSettleInput.parse(await c.req.json());
  const payment = await db.query.payments.findFirst({
    where: and(eq(schema.payments.id, input.paymentId), eq(schema.payments.tenantId, id.tenantId)),
  });
  if (!payment) throw new ProblemError(404, 'NOT_FOUND', 'Payment not found');
  if (payment.provider !== 'manual') {
    throw new ProblemError(409, 'CONFLICT', 'Mock settle hanya untuk dev mode (no Midtrans creds)');
  }
  await db
    .update(schema.payments)
    .set({ status: 'settled', settledAt: new Date(), receivedAt: new Date() })
    .where(eq(schema.payments.id, payment.id));
  const status = await markPaidIfCovered(id.tenantId, payment.orderId);
  if (status.paid) {
    await enqueueRecipeDeduct({
      tenantId: id.tenantId,
      outletId: payment.outletId,
      orderId: payment.orderId,
      performedBy: id.userId,
    });
  }
  return c.json({ ok: true, orderPaid: status.paid, remainingDue: status.remaining.toString() });
});

const RecordCardInput = z.object({
  orderId: z.string().uuid(),
  amount: z.coerce.bigint(),
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  notes: z.string().max(500).nullable().optional(),
});

paymentRouter.post('/card-edc', requirePermission('payment:record'), idempotency, async (c) => {
  const id = c.get('identity');
  const input = RecordCardInput.parse(await c.req.json());
  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, input.orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');

  const paymentId = uuidv7();
  await db.insert(schema.payments).values({
    id: paymentId,
    tenantId: id.tenantId,
    orderId: order.id,
    outletId: order.outletId,
    method: 'card_edc',
    provider: 'manual',
    amount: input.amount,
    status: 'settled',
    receivedAt: new Date(),
    settledAt: new Date(),
    recordedBy: id.userId,
    notes: input.cardLast4 ? `EDC ****${input.cardLast4}` : input.notes ?? null,
  });
  const status = await markPaidIfCovered(id.tenantId, order.id);
  if (status.paid) {
    await enqueueRecipeDeduct({
      tenantId: id.tenantId,
      outletId: order.outletId,
      orderId: order.id,
      performedBy: id.userId,
    });
  }
  return c.json(
    { ok: true, paymentId, orderPaid: status.paid, remainingDue: status.remaining.toString() },
    201,
  );
});

const RefundInput = z.object({
  paymentId: z.string().uuid(),
  amount: z.coerce.bigint().positive(),
  reason: z.string().min(1).max(500),
});

paymentRouter.post('/refund', requirePermission('payment:refund'), async (c) => {
  const id = c.get('identity');
  const input = RefundInput.parse(await c.req.json());
  const payment = await db.query.payments.findFirst({
    where: and(eq(schema.payments.id, input.paymentId), eq(schema.payments.tenantId, id.tenantId)),
  });
  if (!payment) throw new ProblemError(404, 'NOT_FOUND', 'Payment not found');
  if (payment.status !== 'settled') {
    throw new ProblemError(409, 'CONFLICT', `Payment status ${payment.status} tidak bisa di-refund`);
  }
  if (input.amount > payment.amount) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Refund melebihi jumlah pembayaran');
  }

  const refundId = uuidv7();
  await db.insert(schema.paymentRefunds).values({
    id: refundId,
    tenantId: id.tenantId,
    paymentId: input.paymentId,
    amount: input.amount,
    reason: input.reason,
    providerRef: null,
    status: payment.method === 'cash' || payment.method === 'card_edc' ? 'succeeded' : 'pending',
    refundedBy: id.userId,
    refundedAt: new Date(),
  });

  const newStatus = input.amount === payment.amount ? 'refunded' : 'partially_refunded';
  await db
    .update(schema.payments)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(schema.payments.id, input.paymentId));

  return c.json({ refundId, status: newStatus }, 201);
});
