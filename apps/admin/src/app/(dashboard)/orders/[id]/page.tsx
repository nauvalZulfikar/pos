import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { RefundForm } from './refund-form';

type OrderItem = {
  id: string;
  itemNameSnapshot: string;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  status: string;
};

type Order = {
  id: string;
  outletOrderNumber: string;
  status: string;
  subtotal: string;
  discountTotal: string;
  serviceCharge: string;
  ppnTotal: string;
  total: string;
  paidAt: string | null;
  createdAt: string;
  customerName: string | null;
  notes: string | null;
  items: OrderItem[];
};

type Payment = {
  id: string;
  method: string;
  amount: string;
  status: string;
  cardLast4: string | null;
  capturedAt: string | null;
};

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let order: Order | null = null;
  let payments: Payment[] = [];
  let error: string | null = null;

  try {
    const r = await apiFetch<{ order: Order }>(`/v1/orders/${id}`);
    order = r.order;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Order tidak ditemukan';
  }

  try {
    const p = await apiFetch<{ items: Payment[] }>(`/v1/payments/by-order/${id}`);
    payments = p.items;
  } catch {
    /* ignore */
  }

  if (error || !order) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Order tidak ditemukan'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <Link href="/orders" className="text-sm text-slate-500 hover:underline">
          ← Order
        </Link>
        <h1 className="text-2xl font-semibold">Order #{order.outletOrderNumber}</h1>
        <p className="text-sm text-slate-500">
          Status: <b>{order.status}</b> ·{' '}
          {new Date(order.paidAt ?? order.createdAt).toLocaleString('id-ID')}
        </p>
      </header>

      {order.customerName ? (
        <p className="text-sm text-slate-600">
          Pelanggan: <b>{order.customerName}</b>
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Item</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Harga</th>
              <th className="px-4 py-2 text-right">Subtotal</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
              <tr key={it.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{it.itemNameSnapshot}</td>
                <td className="px-4 py-2 text-right">{it.quantity}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(BigInt(it.unitPrice))}
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatCurrency(BigInt(it.lineSubtotal))}
                </td>
                <td className="px-4 py-2 text-xs text-slate-500">{it.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Total
          </h2>
          <Row label="Subtotal" value={formatCurrency(BigInt(order.subtotal))} />
          {BigInt(order.discountTotal) > BigInt(0) ? (
            <Row label="Diskon" value={`−${formatCurrency(BigInt(order.discountTotal))}`} />
          ) : null}
          {BigInt(order.serviceCharge) > BigInt(0) ? (
            <Row label="Service" value={formatCurrency(BigInt(order.serviceCharge))} />
          ) : null}
          {BigInt(order.ppnTotal) > BigInt(0) ? (
            <Row label="PPN" value={formatCurrency(BigInt(order.ppnTotal))} />
          ) : null}
          <hr className="my-2 border-slate-200" />
          <Row label="TOTAL" value={formatCurrency(BigInt(order.total))} bold />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Pembayaran ({payments.length})
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada pembayaran.</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="rounded border border-slate-200 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium uppercase">{p.method}</span>
                    <span className="font-mono">{formatCurrency(BigInt(p.amount))}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Status: {p.status}
                    {p.cardLast4 ? ` · **** ${p.cardLast4}` : ''}
                  </div>
                  {p.status === 'settled' ? (
                    <RefundForm
                      paymentId={p.id}
                      amount={p.amount}
                      method={p.method}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {order.notes ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Catatan
          </h2>
          <p>{order.notes}</p>
        </section>
      ) : null}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div
      className={`flex justify-between py-1 ${bold ? 'text-lg font-semibold' : 'text-sm'}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
