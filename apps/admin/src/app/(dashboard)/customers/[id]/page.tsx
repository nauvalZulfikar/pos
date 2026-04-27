import Link from 'next/link';
import { apiFetch, ApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phoneHash: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  tags: string[];
  isActive: boolean;
  createdAt: string;
};

type Order = {
  id: string;
  outletOrderNumber: string;
  total: string;
  paidAt: string | null;
  status: string;
};

type LoyaltyAccount = {
  pointsBalance: number;
  tier: string;
  lifetimeSpend: string;
} | null;

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer: Customer | null = null;
  let orders: Order[] = [];
  let loyalty: LoyaltyAccount = null;
  let error: string | null = null;

  try {
    const r = await apiFetch<{ customer: Customer; orders: Order[] }>(
      `/v1/customers/${id}`,
    );
    customer = r.customer;
    orders = r.orders;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Customer tidak ditemukan';
  }

  try {
    const l = await apiFetch<{ account: LoyaltyAccount }>(
      `/v1/loyalty/account/${id}`,
    );
    loyalty = l.account;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 403) {
      // 403 = loyalty_points feature not enabled — silently skip
    }
  }

  if (error || !customer) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ?? 'Customer tidak ditemukan'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/customers" className="text-sm text-slate-500 hover:underline">
            ← Pelanggan
          </Link>
          <h1 className="text-2xl font-semibold">{customer.fullName}</h1>
          <p className="text-sm text-slate-500">
            {customer.email ?? 'Tanpa email'} · {customer.visitCount} kunjungan
          </p>
        </div>
        {!customer.isActive ? (
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">Nonaktif</span>
        ) : null}
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Visit count" value={customer.visitCount.toString()} />
        <Stat
          label="Last visit"
          value={
            customer.lastVisitAt
              ? new Date(customer.lastVisitAt).toLocaleDateString('id-ID')
              : '—'
          }
        />
        <Stat
          label="Member sejak"
          value={new Date(customer.createdAt).toLocaleDateString('id-ID')}
        />
      </section>

      {loyalty ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-emerald-800">
            Loyalty
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Tier" value={loyalty.tier.toUpperCase()} />
            <Stat label="Poin" value={loyalty.pointsBalance.toLocaleString('id-ID')} />
            <Stat
              label="Lifetime spend"
              value={formatCurrency(BigInt(loyalty.lifetimeSpend))}
            />
          </div>
        </section>
      ) : null}

      {customer.tags.length ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {customer.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Riwayat Order ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Belum ada order tercatat untuk pelanggan ini.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">No.</th>
                  <th className="px-4 py-2 text-left">Tanggal bayar</th>
                  <th className="px-4 py-2 text-left">Status</th>
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
                    <td className="px-4 py-2 text-slate-600">
                      {o.paidAt ? new Date(o.paidAt).toLocaleString('id-ID') : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          o.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {o.status}
                      </span>
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
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
