import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Outlet = { id: string; name: string; code: string };
type Order = {
  id: string;
  outletId: string;
  outletOrderNumber: string;
  status: string;
  total: string;
  paidAt: string | null;
  createdAt: string;
};

export const dynamic = 'force-dynamic';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ outletId?: string; status?: string }>;
}) {
  const sp = await searchParams;

  let outlets: Outlet[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Outlet[] }>('/v1/outlets');
    outlets = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat cabang';
  }

  const activeOutletId = sp.outletId ?? outlets[0]?.id;
  let orders: Order[] = [];
  if (activeOutletId) {
    try {
      const params = new URLSearchParams({ outletId: activeOutletId });
      if (sp.status) params.set('status', sp.status);
      const r = await apiFetch<{ items: Order[] }>(`/v1/orders?${params.toString()}`);
      orders = r.items;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Gagal memuat order';
    }
  }

  const statuses = ['', 'open', 'sent_to_kitchen', 'paid', 'voided', 'refunded'];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Order</h1>
        <p className="text-sm text-slate-500">{orders.length} order ditampilkan</p>
      </header>

      <form className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <select
          name="outletId"
          defaultValue={activeOutletId ?? ''}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {s || 'Semua status'}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Filter
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          Belum ada order untuk filter ini.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">No.</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono">
                    <Link href={`/orders/${o.id}`} className="hover:underline">
                      #{o.outletOrderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <StatusPill status={o.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {new Date(o.paidAt ?? o.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(BigInt(o.total))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'paid'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'voided' || status === 'refunded'
        ? 'bg-red-100 text-red-800'
        : status === 'open'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>{status}</span>;
}
