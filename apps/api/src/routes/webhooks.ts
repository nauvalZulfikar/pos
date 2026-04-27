import { eq, db, schema } from '@desain/db';
import { payment as paymentInt } from '@desain/integrations';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { redis } from '../redis.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import type { RequestVars } from '../context.js';

export const webhookRouter = new Hono<{ Variables: RequestVars }>();

/** Midtrans webhook. Signature verified inside the adapter. */
webhookRouter.post('/midtrans', async (c) => {
  const headers = Object.fromEntries(
    Object.entries(c.req.header()).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const body = await c.req.json();

  const cfg = env();
  if (!cfg.MIDTRANS_SERVER_KEY) return c.json({ error: 'midtrans not configured' }, 503);

  const provider = new paymentInt.MidtransProvider({
    serverKey: cfg.MIDTRANS_SERVER_KEY,
    isProduction: cfg.MIDTRANS_IS_PRODUCTION,
  });

  let event;
  try {
    event = provider.parseWebhook(headers, body);
  } catch (err) {
    logger.warn({ err }, 'midtrans webhook signature failed');
    return c.json({ error: 'signature' }, 401);
  }

  // Replay protection: dedupe by externalEventId in Redis (24h).
  const seenKey = `wh:midtrans:${event.externalEventId}`;
  const ok = await redis.set(seenKey, '1', 'EX', 24 * 3600, 'NX');
  if (ok !== 'OK') {
    return c.json({ ok: true, replayed: true });
  }

  // Match payment by providerRef and update status.
  const payment = await db.query.payments.findFirst({
    where: eq(schema.payments.providerRef, event.providerRef),
  });
  if (payment) {
    await db
      .update(schema.payments)
      .set({
        status:
          event.status === 'settled'
            ? 'settled'
            : event.status === 'refunded'
              ? 'refunded'
              : 'failed',
        settledAt: event.status === 'settled' ? new Date(event.paidAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(schema.payments.id, payment.id));
  }
  return c.json({ ok: true });
});

webhookRouter.post('/delivery/:platform', async (c) => {
  const platform = c.req.param('platform');
  const headers = Object.fromEntries(
    Object.entries(c.req.header()).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const body = await c.req.json();

  // Persist for the worker to process. We DON'T do business logic here.
  const externalEventId = (body as { event_id?: string }).event_id ?? uuidv7();
  await db
    .insert(schema.deliveryWebhookEvents)
    .values({
      id: uuidv7(),
      tenantId: '00000000-0000-0000-0000-000000000000', // resolved by worker
      platform,
      externalEventId,
      eventType: (body as { event?: string }).event ?? 'unknown',
      payload: { headers, body },
      status: 'queued',
    })
    .onConflictDoNothing();
  return c.json({ ok: true });
});
