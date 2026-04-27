import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Outlet = { id: string; name: string; isActive: boolean };
type DailyReport = {
  outletId: string | null;
  orderCount: number;
  voidCount: number;
  grossSales: string;
  avgOrderValue: string;
  ppnTotal: string;
};

export const dynamic = 'force-dynamic';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function OverviewPage() {
  const today = isoDate(new Date());

  let outlets: Outlet[] = [];
  let perOutlet: Array<{ outlet: Outlet; report: DailyReport | null }> = [];
  const total = { orderCount: 0, grossSales: BigInt(0), voidCount: 0 };
  let error: string | null = null;

  try {
    const r = await apiFetch<{ items: Outlet[] }>('/v1/outlets');
    outlets = r.items.filter((o) => o.isActive);

    perOutlet = await Promise.all(
      outlets.map(async (outlet) => {
        try {
          const report = await apiFetch<DailyReport>(
            `/v1/reports/daily?day=${today}&outletId=${outlet.id}`,
          );
          return { outlet, report };
        } catch {
          return { outlet, report: null };
        }
      }),
    );

    for (const e of perOutlet) {
      if (!e.report) continue;
      total.orderCount += e.report.orderCount;
      total.voidCount += e.report.voidCount;
      total.grossSales += BigInt(e.report.grossSales);
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  const avgPerOrder =
    total.orderCount > 0 ? (total.grossSales / BigInt(total.orderCount)).toString() : '0';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ringkasan</h1>
        <p className="text-sm text-slate-500">
          Hari ini · {outlets.length} cabang aktif · Asia/Jakarta
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KpiTile label="Penjualan Total" value={formatCurrency(total.grossSales)} />
        <KpiTile label="Order Total" value={total.orderCount.toString()} />
        <KpiTile label="Avg/Order" value={formatCurrency(BigInt(avgPerOrder))} />
        <KpiTile label="Void" value={total.voidCount.toString()} negative />
      </section>

      {outlets.length > 1 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold">Per cabang</h2>
          <div className="overflow-hidden rounded-md border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Cabang</th>
                  <th className="px-4 py-2 text-right">Penjualan</th>
                  <th className="px-4 py-2 text-right">Order</th>
                  <th className="px-4 py-2 text-right">Avg/Order</th>
                  <th className="px-4 py-2 text-right">Void</th>
                </tr>
              </thead>
              <tbody>
                {perOutlet.map(({ outlet, report }) => (
                  <tr key={outlet.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium">{outlet.name}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(BigInt(report?.grossSales ?? '0'))}
                    </td>
                    <td className="px-4 py-2 text-right">{report?.orderCount ?? 0}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(BigInt(report?.avgOrderValue ?? '0'))}
                    </td>
                    <td className="px-4 py-2 text-right">{report?.voidCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function KpiTile({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold ${negative ? 'text-red-700' : ''}`}>
        {value}
      </p>
    </div>
  );
}
