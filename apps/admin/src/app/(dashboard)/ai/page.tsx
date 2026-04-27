import { apiFetch } from '@/lib/api';

type DailyBrief = {
  id: string;
  businessDay: string;
  narrative: string;
  recommendation: { title: string; detail: string; expectedImpact: string };
  modelId: string;
};

type Anomaly = {
  id: string;
  detectedAt: string;
  metric: string;
  severity: string;
  expectedValue: string | null;
  observedValue: string | null;
  detail: { diffPct?: number };
};

export const dynamic = 'force-dynamic';

export default async function AiPage() {
  let briefs: DailyBrief[] = [];
  let anomalies: Anomaly[] = [];
  let error: string | null = null;
  try {
    const [b, a] = await Promise.all([
      apiFetch<{ items: DailyBrief[] }>('/v1/ai/daily-briefs?limit=14'),
      apiFetch<{ items: Anomaly[] }>('/v1/ai/anomalies'),
    ]);
    briefs = b.items;
    anomalies = a.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal — pastikan modul AI aktif di Pengaturan';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">AI Brief</h1>
        <p className="text-sm text-slate-500">Ringkasan harian, anomali, scoring menu</p>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Daily Brief</h2>
        {briefs.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada brief tersimpan. Worker generate setiap pagi 00:30 WIB jika modul aktif.
          </p>
        ) : (
          <div className="space-y-4">
            {briefs.slice(0, 1).map((b) => (
              <article key={b.id} className="rounded-lg bg-emerald-50 p-4">
                <header className="mb-2 flex items-center justify-between">
                  <h3 className="font-semibold">{b.businessDay}</h3>
                  <span className="rounded bg-white px-2 py-0.5 text-xs text-slate-500">
                    {b.modelId}
                  </span>
                </header>
                <pre className="whitespace-pre-wrap text-sm text-slate-700">{b.narrative}</pre>
                <div className="mt-3 rounded-md border border-emerald-300 bg-white p-3">
                  <p className="text-xs uppercase tracking-wider text-emerald-700">
                    Rekomendasi prioritas
                  </p>
                  <p className="mt-1 font-semibold">{b.recommendation.title}</p>
                  <p className="text-sm">{b.recommendation.detail}</p>
                  <p className="mt-1 text-xs italic text-slate-500">
                    Dampak: {b.recommendation.expectedImpact}
                  </p>
                </div>
              </article>
            ))}
            {briefs.slice(1).map((b) => (
              <article key={b.id} className="border-t border-slate-100 pt-3">
                <h3 className="text-sm font-medium">{b.businessDay}</h3>
                <pre className="mt-1 text-xs text-slate-600 line-clamp-3">{b.narrative}</pre>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Anomali Terdeteksi</h2>
        {anomalies.length === 0 ? (
          <p className="text-sm text-slate-500">Tidak ada anomali baru.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {anomalies.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span
                    className={`mr-2 rounded px-2 py-0.5 text-xs ${
                      a.severity === 'high'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                  <span className="font-medium">{a.metric}</span>
                  {a.detail.diffPct !== undefined ? (
                    <span className="ml-2 text-xs text-slate-500">
                      {a.detail.diffPct > 0 ? '+' : ''}
                      {a.detail.diffPct.toFixed(1)}% vs baseline
                    </span>
                  ) : null}
                </div>
                <time className="text-xs text-slate-500">
                  {new Date(a.detectedAt).toLocaleString('id-ID')}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
