import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type DailyReport = {
  day: string;
  outletId: string | null;
  orderCount: number;
  voidCount: number;
  grossSales: string;
  discountTotal: string;
  ppnTotal: string;
  serviceCharge: string;
  avgOrderValue: string;
};

type TrendPoint = { day: string; orderCount: number; grossSales: string };

type TopItem = { menuItemId: string; itemName: string; quantity: number; revenue: string };

export const dynamic = 'force-dynamic';

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export default async function ReportsPage() {
  const today = isoDaysAgo(0);
  const sevenDaysAgo = isoDaysAgo(7);

  let daily: DailyReport | null = null;
  let trend: TrendPoint[] = [];
  let topItems: TopItem[] = [];
  let error: string | null = null;
  try {
    const [d, t, top] = await Promise.all([
      apiFetch<DailyReport>(`/v1/reports/daily?day=${today}`),
      apiFetch<{ series: TrendPoint[] }>(`/v1/reports/sales-trend?from=${sevenDaysAgo}&to=${today}`),
      apiFetch<{ items: TopItem[] }>(
        `/v1/reports/top-items?from=${sevenDaysAgo}&to=${today}&limit=5`,
      ),
    ]);
    daily = d;
    trend = t.series;
    topItems = top.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat laporan';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Laporan</h1>
          <p className="text-sm text-slate-500">7 hari terakhir · Asia/Jakarta</p>
        </div>
        <a
          href="/reports/peak-hours"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          📊 Peak Hours →
        </a>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {daily ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiTile label="Penjualan Hari Ini" value={formatCurrency(BigInt(daily.grossSales))} />
          <KpiTile label="Order" value={daily.orderCount.toString()} />
          <KpiTile label="Avg/Order" value={formatCurrency(BigInt(daily.avgOrderValue))} />
          <KpiTile label="Void" value={daily.voidCount.toString()} negative />
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Tren 7 Hari</h2>
        {trend.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada data penjualan dalam periode ini.</p>
        ) : (
          <SalesTrendBars series={trend} />
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Top 5 Item</h2>
        {topItems.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada penjualan item dalam periode ini.</p>
        ) : (
          <ol className="space-y-2">
            {topItems.map((it, i) => (
              <li
                key={it.menuItemId}
                className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                    {i + 1}
                  </span>
                  <span className="font-medium">{it.itemName}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{formatCurrency(BigInt(it.revenue))}</div>
                  <div className="text-xs text-slate-500">{it.quantity}× terjual</div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {daily ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-semibold">Pajak & Diskon Hari Ini</h2>
          <dl className="grid grid-cols-2 gap-4">
            <KvRow label="PPN terkumpul" value={formatCurrency(BigInt(daily.ppnTotal))} />
            <KvRow label="Service charge" value={formatCurrency(BigInt(daily.serviceCharge))} />
            <KvRow label="Total diskon" value={formatCurrency(BigInt(daily.discountTotal))} />
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function KpiTile({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${negative ? 'text-red-700' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function SalesTrendBars({ series }: { series: TrendPoint[] }) {
  const max = series.reduce(
    (acc, p) => (BigInt(p.grossSales) > acc ? BigInt(p.grossSales) : acc),
    BigInt(0),
  );
  return (
    <div className="space-y-2">
      {series.map((p) => {
        const value = BigInt(p.grossSales);
        const pct = max > BigInt(0) ? Number((value * BigInt(100)) / max) : 0;
        return (
          <div key={p.day} className="flex items-center gap-3">
            <span className="w-20 text-xs text-slate-500">{p.day.slice(5)}</span>
            <div className="relative h-6 flex-1 overflow-hidden rounded bg-slate-100">
              <div
                className="absolute inset-y-0 left-0 bg-emerald-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-32 text-right font-mono text-xs">{formatCurrency(value)}</span>
            <span className="w-16 text-right text-xs text-slate-500">{p.orderCount} order</span>
          </div>
        );
      })}
    </div>
  );
}
