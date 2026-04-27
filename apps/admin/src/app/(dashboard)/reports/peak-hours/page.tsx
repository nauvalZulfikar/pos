import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type PeakRow = { hour: number; orderCount: number; revenue: string };
type PeakResponse = {
  from: string;
  to: string;
  series: PeakRow[];
  peakHours: number[];
};

export const dynamic = 'force-dynamic';

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default async function PeakHoursPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const from = sp.from ?? isoDaysAgo(30);
  const to = sp.to ?? isoDaysAgo(0);

  let data: PeakResponse | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<PeakResponse>(
      `/v1/reports/peak-hours?from=${from}&to=${to}`,
    );
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  const max = data
    ? data.series.reduce((acc, r) => Math.max(acc, Number(BigInt(r.revenue))), 0)
    : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Peak Hour Optimization</h1>
        <p className="text-sm text-slate-500">
          Distribusi order per jam untuk identifikasi jam sibuk & rekomendasi staffing.
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
      ) : data ? (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-800">
              Top 3 jam sibuk
            </h2>
            <p className="mt-1 text-lg font-semibold">
              {data.peakHours.map((h) => `${String(h).padStart(2, '0')}:00`).join(', ') ||
                '—'}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Rekomendasi: jadwalkan staf tambahan & happy hour voucher di luar jam-jam ini.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Jam</th>
                  <th className="px-4 py-2 text-right">Order</th>
                  <th className="px-4 py-2 text-right">Pendapatan</th>
                  <th className="px-4 py-2 text-left">Distribusi</th>
                </tr>
              </thead>
              <tbody>
                {data.series.map((r) => {
                  const pct = max > 0 ? (Number(BigInt(r.revenue)) / max) * 100 : 0;
                  const isPeak = data.peakHours.includes(r.hour);
                  return (
                    <tr
                      key={r.hour}
                      className={`border-t border-slate-100 ${
                        isPeak ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <td className="px-4 py-2 font-mono">
                        {String(r.hour).padStart(2, '0')}:00
                      </td>
                      <td className="px-4 py-2 text-right">{r.orderCount}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatCurrency(BigInt(r.revenue))}
                      </td>
                      <td className="w-1/3 px-4 py-2">
                        <div
                          className="h-3 rounded bg-emerald-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}
