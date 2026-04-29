import { apiFetch } from '@/lib/api';
import { RefreshButton } from './refresh-button';

type Forecast = {
  id: string;
  menuItemId: string;
  targetDay: string;
  expectedQty: number;
  lowerQty: number;
  upperQty: number;
  sampleDays: number;
  method: string;
};

type MenuItem = { id: string; name: string };

export const dynamic = 'force-dynamic';

export default async function DemandForecastPage() {
  let forecasts: Forecast[] = [];
  let menuItems: MenuItem[] = [];
  let error: string | null = null;
  try {
    const [f, m] = await Promise.all([
      apiFetch<{ items: Forecast[] }>('/v1/ai/demand-forecasts'),
      apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
    ]);
    forecasts = f.items;
    menuItems = m.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat forecast';
  }

  const itemNames = new Map(menuItems.map((m) => [m.id, m.name]));

  // Pivot: rows = menu items, columns = days
  const days = Array.from(new Set(forecasts.map((f) => f.targetDay))).sort();
  const byItem = new Map<string, Map<string, Forecast>>();
  for (const f of forecasts) {
    const map = byItem.get(f.menuItemId) ?? new Map();
    map.set(f.targetDay, f);
    byItem.set(f.menuItemId, map);
  }

  const totalSampleDays = forecasts[0]?.sampleDays ?? 0;
  const isInsufficient = forecasts.length === 0 && totalSampleDays < 60;

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Demand Forecasting</h1>
          <p className="text-sm text-slate-500">
            Prediksi 7 hari ke depan — seasonal-naive + boost hari libur nasional Indonesia.
          </p>
          {totalSampleDays > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Berdasarkan {totalSampleDays} hari data historis. Ideal ≥90 hari.
            </p>
          ) : null}
        </div>
        <RefreshButton />
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {forecasts.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold">Belum ada forecast</h2>
          <p className="mt-1 text-sm text-slate-500">
            {isInsufficient
              ? 'Butuh minimal 60 hari data penjualan untuk forecast yang andal.'
              : 'Klik tombol Refresh untuk hitung sekarang.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-2 text-left">Menu</th>
                {days.map((d) => (
                  <th key={d} className="px-3 py-2 text-right">
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...byItem.entries()].slice(0, 50).map(([menuItemId, map]) => (
                <tr key={menuItemId} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white px-4 py-2 font-medium">
                    {itemNames.get(menuItemId) ?? '—'}
                  </td>
                  {days.map((d) => {
                    const f = map.get(d);
                    if (!f) return <td key={d} className="px-3 py-2 text-right text-slate-300">—</td>;
                    const isHoliday = f.method.includes('holiday');
                    return (
                      <td
                        key={d}
                        className={`px-3 py-2 text-right font-mono ${
                          isHoliday ? 'bg-amber-50 text-amber-800' : ''
                        }`}
                        title={`Range ${f.lowerQty}–${f.upperQty}${isHoliday ? ' (libur)' : ''}`}
                      >
                        {f.expectedQty}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        Cell kuning = hari libur nasional (boost +20%). Hover cell untuk lihat range 80% confidence.
      </p>
    </div>
  );
}
