import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Row = { source: string; orders: number; revenue: string };
type Response = { items: Row[] };

const PLATFORM_META: Record<string, { label: string; color: string }> = {
  dine_in: { label: 'Dine-in', color: 'bg-emerald-500' },
  gofood: { label: 'GoFood', color: 'bg-green-600' },
  grabfood: { label: 'GrabFood', color: 'bg-emerald-700' },
  shopeefood: { label: 'ShopeeFood', color: 'bg-orange-500' },
};

export const dynamic = 'force-dynamic';

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function DeliveryAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ?? isoDaysAgo(30);
  const to = sp.to ?? isoDaysAgo(0);

  let dineIn: Row | null = null;
  let delivery: Row[] = [];
  let error: string | null = null;
  try {
    const data = await apiFetch<Response>(
      `/v1/delivery/analytics?from=${from}&to=${to}`,
    );
    delivery = data.items;
    // Also pull dine-in from sales-trend totals.
    const trend = await apiFetch<{
      series: { day: string; orderCount: number; grossSales: string }[];
    }>(`/v1/reports/sales-trend?from=${from}&to=${to}`);
    const allOrders = trend.series.reduce((acc, p) => acc + p.orderCount, 0);
    const allRev = trend.series.reduce((acc, p) => acc + BigInt(p.grossSales), BigInt(0));
    const deliveryOrders = delivery.reduce((acc, r) => acc + r.orders, 0);
    const deliveryRev = delivery.reduce((acc, r) => acc + BigInt(r.revenue), BigInt(0));
    dineIn = {
      source: 'dine_in',
      orders: Math.max(0, allOrders - deliveryOrders),
      revenue: (allRev - deliveryRev).toString(),
    };
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  const all = dineIn ? [dineIn, ...delivery] : delivery;
  const totalOrders = all.reduce((acc, r) => acc + r.orders, 0);
  const totalRev = all.reduce((acc, r) => acc + BigInt(r.revenue), BigInt(0));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Delivery Analytics</h1>
        <p className="text-sm text-slate-500">
          Perbandingan revenue & order: dine-in vs delivery platform.
        </p>
      </header>

      <form className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-sm">
          <span className="mr-1 text-slate-600">Dari:</span>
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mr-1 text-slate-600">Sampai:</span>
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          />
        </label>
        <button className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
          Update
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Tile label="Total Order" value={totalOrders.toLocaleString('id-ID')} />
            <Tile label="Total Revenue" value={formatCurrency(totalRev)} />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">Distribusi per Channel</h2>
            <div className="space-y-3">
              {all.map((r) => {
                const meta = PLATFORM_META[r.source] ?? {
                  label: r.source,
                  color: 'bg-slate-400',
                };
                const rev = BigInt(r.revenue);
                const pct =
                  totalRev > BigInt(0)
                    ? Number((rev * BigInt(10000)) / totalRev) / 100
                    : 0;
                return (
                  <div key={r.source}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{meta.label}</span>
                      <span className="font-mono">
                        {formatCurrency(rev)} · {r.orders} order ·{' '}
                        <span className="text-slate-500">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded bg-slate-100">
                      <div
                        className={`h-full ${meta.color}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}
