/**
 * e-Faktur generator. AGENTS.md §15.2.
 *
 * Generates DJP-compliant XML for B2B transactions where the customer
 * has provided NPWP. Production submission requires Sertifikat Elektronik
 * (separate KYB process); this endpoint produces the XML payload.
 */

import { and, db, eq, gte, isNotNull, lte, schema } from '@desain/db';
import { ProblemError } from '@desain/types';
import { Hono } from 'hono';
import { authRequired } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant-context.js';
import { requirePermission } from '../middleware/permission.js';
import { requireFeatures } from '../middleware/entitlement.js';
import type { RequestVars } from '../context.js';

export const efakturRouter = new Hono<{ Variables: RequestVars }>();

efakturRouter.use('*', authRequired, tenantContext, requireFeatures(['efaktur_b2b']));

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

efakturRouter.get('/orders/:id', requirePermission('reports:export'), async (c) => {
  const id = c.get('identity');
  const orderId = c.req.param('id');

  const order = await db.query.orders.findFirst({
    where: and(eq(schema.orders.id, orderId), eq(schema.orders.tenantId, id.tenantId)),
  });
  if (!order) throw new ProblemError(404, 'NOT_FOUND', 'Order not found');
  if (order.status !== 'paid') {
    throw new ProblemError(409, 'CONFLICT', 'Order belum dibayar.');
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, id.tenantId),
  });
  if (!tenant?.isPkp || !tenant.npwp) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Tenant bukan PKP atau NPWP tidak terdaftar.');
  }

  const items = await db.query.orderItems.findMany({
    where: and(
      eq(schema.orderItems.tenantId, id.tenantId),
      eq(schema.orderItems.orderId, orderId),
    ),
  });

  // Build minimal e-Faktur XML. Real DJP schema is more complex; this is the
  // structural skeleton that production integration will extend.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eFaktur>
  <FK>
    <KD_JENIS_TRANSAKSI>01</KD_JENIS_TRANSAKSI>
    <FG_PENGGANTI>0</FG_PENGGANTI>
    <NOMOR_FAKTUR>AUTO-${order.outletOrderNumber}</NOMOR_FAKTUR>
    <MASA_PAJAK>${new Date(order.paidAt!).getMonth() + 1}</MASA_PAJAK>
    <TAHUN_PAJAK>${new Date(order.paidAt!).getFullYear()}</TAHUN_PAJAK>
    <TANGGAL_FAKTUR>${new Date(order.paidAt!).toISOString().slice(0, 10)}</TANGGAL_FAKTUR>
    <NPWP_LAWAN_TRANSAKSI>${order.customerPhone ?? ''}</NPWP_LAWAN_TRANSAKSI>
    <NAMA_LAWAN_TRANSAKSI>${escapeXml(order.customerName ?? 'Konsumen Akhir')}</NAMA_LAWAN_TRANSAKSI>
    <JUMLAH_DPP>${(order.subtotal - order.discountTotal + order.serviceCharge).toString()}</JUMLAH_DPP>
    <JUMLAH_PPN>${order.ppnTotal.toString()}</JUMLAH_PPN>
    <JUMLAH_PPNBM>0</JUMLAH_PPNBM>
    <STATUS_APPROVAL>0</STATUS_APPROVAL>
    <STATUS_FAKTUR>1</STATUS_FAKTUR>
    <REFERENSI>${escapeXml(orderId)}</REFERENSI>
${items
  .filter((i) => i.status !== 'voided')
  .map(
    (i) => `    <OF>
      <KODE_OBJEK>000000</KODE_OBJEK>
      <NAMA>${escapeXml(i.itemNameSnapshot)}</NAMA>
      <HARGA_SATUAN>${i.unitPrice.toString()}</HARGA_SATUAN>
      <JUMLAH_BARANG>${i.quantity}</JUMLAH_BARANG>
      <HARGA_TOTAL>${i.lineSubtotal.toString()}</HARGA_TOTAL>
      <DISKON>0</DISKON>
      <DPP>${i.lineSubtotal.toString()}</DPP>
      <PPN>${((i.lineSubtotal * BigInt(i.ppnBpsSnapshot)) / BigInt(10_000)).toString()}</PPN>
    </OF>`,
  )
  .join('\n')}
  </FK>
</eFaktur>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'content-disposition': `attachment; filename="efaktur-${order.outletOrderNumber}.xml"`,
    },
  });
});

/**
 * Bulk e-Faktur CSV — DJP-friendly format for batch upload via the desktop app.
 * Filters: paid orders only, with NPWP customers, in the [from, to] business-day range.
 */
efakturRouter.get('/export.csv', requirePermission('reports:export'), async (c) => {
  const id = c.get('identity');
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'from & to (YYYY-MM-DD) wajib');
  }

  const orders = await db.query.orders.findMany({
    where: and(
      eq(schema.orders.tenantId, id.tenantId),
      eq(schema.orders.status, 'paid'),
      gte(schema.orders.businessDay, from),
      lte(schema.orders.businessDay, to),
      isNotNull(schema.orders.customerPhone),
    ),
    limit: 5000,
  });

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, id.tenantId),
  });
  if (!tenant?.isPkp) {
    throw new ProblemError(400, 'VALIDATION_FAILED', 'Tenant bukan PKP');
  }

  // CSV header per DJP e-Faktur "FK" record layout (subset).
  const header = [
    'FK',
    'KD_JENIS_TRANSAKSI',
    'FG_PENGGANTI',
    'NOMOR_FAKTUR',
    'MASA_PAJAK',
    'TAHUN_PAJAK',
    'TANGGAL_FAKTUR',
    'NPWP_LAWAN',
    'NAMA_LAWAN',
    'JUMLAH_DPP',
    'JUMLAH_PPN',
    'REFERENSI',
  ];
  const rows = orders.map((o) => {
    const paidAt = o.paidAt ? new Date(o.paidAt) : new Date();
    const dpp = o.subtotal - o.discountTotal + o.serviceCharge;
    return [
      'FK',
      '01',
      '0',
      `AUTO-${o.outletOrderNumber}`,
      String(paidAt.getMonth() + 1),
      String(paidAt.getFullYear()),
      paidAt.toISOString().slice(0, 10),
      o.customerPhone ?? '',
      csvEscape(o.customerName ?? 'Konsumen Akhir'),
      dpp.toString(),
      o.ppnTotal.toString(),
      o.id,
    ].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="efaktur-${from}_${to}.csv"`,
    },
  });
});

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
