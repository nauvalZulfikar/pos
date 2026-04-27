/**
 * Receipt rendering. AGENTS.md §15.3.
 *
 * Two outputs from one source of truth:
 *   - ESC/POS commands for thermal printers
 *   - Plain HTML/text for digital receipts (WhatsApp, email, PDF)
 */

import { formatIDR } from './money.js';

/** Plain receipt input — decoupled from Zod brands. */
export type ReceiptItem = {
  itemNameSnapshot: string;
  quantity: number;
  modifiers: { name: string }[];
  notes: string | null;
  status: string;
  lineSubtotal: bigint;
};

export type ReceiptInput = {
  tenant: { displayName: string; npwp: string | null; isPkp: boolean };
  outlet: {
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    phone: string | null;
  };
  order: {
    outletOrderNumber: string;
    items: readonly ReceiptItem[];
    subtotal: bigint;
    discountTotal: bigint;
    serviceCharge: bigint;
    ppnTotal: bigint;
    rounding: bigint;
    total: bigint;
    createdAt: string;
    paidAt: string | null;
    customerName: string | null;
  };
  kasirName: string;
  payments: readonly { method: string; amount: bigint }[];
  paperWidthChars: number; // 32 for 58mm, 48 for 80mm
};

export function renderReceiptText(input: ReceiptInput): string {
  const w = input.paperWidthChars;
  const lines: string[] = [];

  lines.push(center(input.tenant.displayName.toUpperCase(), w));
  lines.push(center(input.outlet.name, w));
  lines.push(center(input.outlet.addressLine1, w));
  if (input.outlet.addressLine2) lines.push(center(input.outlet.addressLine2, w));
  lines.push(center(input.outlet.city, w));
  if (input.outlet.phone) lines.push(center(`Telp: ${input.outlet.phone}`, w));
  if (input.tenant.isPkp && input.tenant.npwp)
    lines.push(center(`NPWP: ${input.tenant.npwp}`, w));
  lines.push(divider(w));
  lines.push(`No. ${input.order.outletOrderNumber}`);
  lines.push(`Kasir: ${input.kasirName}`);
  if (input.order.customerName) lines.push(`Pelanggan: ${input.order.customerName}`);
  lines.push(`${formatJakarta(new Date(input.order.createdAt))}`);
  lines.push(divider(w));

  for (const item of input.order.items) {
    if (item.status === 'voided') continue;
    lines.push(...renderItem(item, w));
  }

  lines.push(divider(w));
  lines.push(twoCol('Subtotal', formatIDR(input.order.subtotal), w));
  if (input.order.discountTotal !== BigInt(0))
    lines.push(twoCol('Diskon', `-${formatIDR(input.order.discountTotal)}`, w));
  if (input.order.serviceCharge !== BigInt(0))
    lines.push(twoCol('Service', formatIDR(input.order.serviceCharge), w));
  if (input.order.ppnTotal !== BigInt(0))
    lines.push(twoCol('PPN', formatIDR(input.order.ppnTotal), w));
  if (input.order.rounding !== BigInt(0))
    lines.push(twoCol('Pembulatan', formatIDR(input.order.rounding), w));
  lines.push(twoCol('TOTAL', formatIDR(input.order.total), w));

  if (input.payments.length > 0) {
    lines.push(divider(w));
    for (const p of input.payments) {
      lines.push(twoCol(p.method.toUpperCase(), formatIDR(p.amount), w));
    }
  }

  lines.push(divider(w));
  lines.push(center('Terima kasih atas kunjungan Anda', w));
  lines.push(center('-- Powered by DESAIN POS --', w));

  return lines.join('\n');
}

function renderItem(item: ReceiptItem, w: number): string[] {
  const lines: string[] = [];
  const qtyLabel = `${item.quantity}× ${item.itemNameSnapshot}`;
  const priceLabel = formatIDR(item.lineSubtotal);
  lines.push(twoCol(qtyLabel, priceLabel, w));
  for (const m of item.modifiers) {
    lines.push(`  + ${m.name}`);
  }
  if (item.notes) lines.push(`  ${item.notes}`);
  return lines;
}

function divider(w: number) {
  return '-'.repeat(w);
}

function center(s: string, w: number) {
  if (s.length >= w) return s.slice(0, w);
  const pad = Math.floor((w - s.length) / 2);
  return ' '.repeat(pad) + s;
}

function twoCol(left: string, right: string, w: number) {
  if (left.length + right.length + 1 >= w) {
    return `${left}\n${' '.repeat(Math.max(0, w - right.length))}${right}`;
  }
  return `${left}${' '.repeat(w - left.length - right.length)}${right}`;
}

function formatJakarta(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Convert plain text to ESC/POS bytes. Init + text + cut.
 * Caller is responsible for handing this to the printer driver.
 */
export function textToEscPos(text: string): Uint8Array {
  const ESC = 0x1b;
  const GS = 0x1d;
  const init = [ESC, 0x40]; // initialize
  const cut = [GS, 0x56, 0x42, 0x00]; // partial cut
  const body = new TextEncoder().encode(text + '\n\n\n');
  const out = new Uint8Array(init.length + body.length + cut.length);
  out.set(init, 0);
  out.set(body, init.length);
  out.set(cut, init.length + body.length);
  return out;
}
