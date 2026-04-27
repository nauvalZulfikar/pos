import { and, db, eq, isNull, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';
import { z } from 'zod';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import type { RequestVars } from '../context.js';

export const vouchersRouter = new Hono<{ Variables: RequestVars }>();

vouchersRouter.use('*', authRequired, tenantContext);

vouchersRouter.get('/', async (c) => {
  const id = c.get('identity');
  const rows = await db.query.vouchers.findMany({
    where: and(
      eq(schema.vouchers.tenantId, id.tenantId),
      isNull(schema.vouchers.deletedAt),
    ),
  });
  return c.json({ items: rows });
});

const CreateVoucher = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9_-]+$/),
  name: z.string().min(1).max(120),
  type: z.enum(['percent', 'amount', 'happy_hour']),
  value: z.coerce.bigint(),
  minSubtotalRupiah: z.coerce.number().nonnegative().default(0),
  maxUsages: z.coerce.number().int().nonnegative().default(0),
  validFrom: z.string().datetime().nullable().optional(),
  validTo: z.string().datetime().nullable().optional(),
  schedule: z.string().max(500).nullable().optional(),
});

vouchersRouter.post('/', requirePermission('settings:edit'), async (c) => {
  const id = c.get('identity');
  const input = CreateVoucher.parse(await c.req.json());
  const newId = uuidv7();
  await db.insert(schema.vouchers).values({
    id: newId,
    tenantId: id.tenantId,
    code: input.code,
    name: input.name,
    type: input.type,
    value: input.value,
    minSubtotal: BigInt(Math.round(input.minSubtotalRupiah * 100)),
    maxUsages: input.maxUsages,
    usedCount: 0,
    validFrom: input.validFrom ? new Date(input.validFrom) : null,
    validTo: input.validTo ? new Date(input.validTo) : null,
    schedule: input.schedule ?? null,
    isActive: true,
  });
  const created = await db.query.vouchers.findFirst({ where: eq(schema.vouchers.id, newId) });
  return c.json({ voucher: created }, 201);
});

/**
 * Schedule format (JSON string in voucher.schedule):
 *   { "daysOfWeek": [1,2,3,4,5], "start": "17:00", "end": "19:00" }
 * Days: 0=Sun..6=Sat. Times use Asia/Jakarta (UTC+7) wall clock.
 */
function isScheduleActive(scheduleJson: string | null, now: Date): boolean {
  if (!scheduleJson) return true;
  try {
    const sch = JSON.parse(scheduleJson) as {
      daysOfWeek?: number[];
      start?: string;
      end?: string;
    };
    const jakarta = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dow = jakarta.getUTCDay();
    if (sch.daysOfWeek && !sch.daysOfWeek.includes(dow)) return false;
    if (sch.start && sch.end) {
      const hhmm = `${String(jakarta.getUTCHours()).padStart(2, '0')}:${String(jakarta.getUTCMinutes()).padStart(2, '0')}`;
      if (hhmm < sch.start || hhmm > sch.end) return false;
    }
    return true;
  } catch {
    return true;
  }
}

vouchersRouter.post('/redeem', requirePermission('order:apply_discount'), async (c) => {
  const id = c.get('identity');
  const input = z
    .object({
      code: z.string(),
      orderId: z.string().uuid(),
      orderSubtotal: z.coerce.bigint(),
    })
    .parse(await c.req.json());

  const voucher = await db.query.vouchers.findFirst({
    where: and(
      eq(schema.vouchers.tenantId, id.tenantId),
      eq(schema.vouchers.code, input.code.toUpperCase()),
      eq(schema.vouchers.isActive, true),
      isNull(schema.vouchers.deletedAt),
    ),
  });
  if (!voucher) throw new ProblemError(404, 'NOT_FOUND', 'Voucher tidak ditemukan');

  const now = new Date();
  if (voucher.validFrom && voucher.validFrom > now) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Voucher belum berlaku');
  }
  if (voucher.validTo && voucher.validTo < now) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Voucher sudah kadaluarsa');
  }
  if (voucher.maxUsages > 0 && voucher.usedCount >= voucher.maxUsages) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Voucher habis terpakai');
  }
  if (input.orderSubtotal < voucher.minSubtotal) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Belum mencapai minimum pembelian');
  }
  if (!isScheduleActive(voucher.schedule, now)) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Voucher tidak berlaku saat ini (di luar jadwal)');
  }

  let discount: bigint;
  if (voucher.type === 'percent') {
    discount = (input.orderSubtotal * voucher.value) / BigInt(100);
  } else {
    discount = voucher.value;
  }
  if (discount > input.orderSubtotal) discount = input.orderSubtotal;

  // Record redemption + increment used count
  await db.transaction(async (tx) => {
    await tx.insert(schema.voucherRedemptions).values({
      id: uuidv7(),
      tenantId: id.tenantId,
      voucherId: voucher.id,
      orderId: input.orderId,
      discountApplied: discount,
    });
    await tx
      .update(schema.vouchers)
      .set({ usedCount: voucher.usedCount + 1, updatedAt: new Date() })
      .where(eq(schema.vouchers.id, voucher.id));
  });

  return c.json({
    voucherId: voucher.id,
    code: voucher.code,
    discountSen: discount.toString(),
  });
});
