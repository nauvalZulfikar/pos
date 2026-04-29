import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { RefreshButton } from './refresh-button';

type Score = {
  id: string;
  menuItemId: string;
  periodStart: string;
  periodEnd: string;
  category: 'bintang' | 'sapi_perah' | 'tanda_tanya' | 'anjing';
  salesQuantity: number;
  grossRevenue: string;
  grossMargin: string;
  rationale: string | null;
};

type MenuItem = { id: string; name: string };

const CATEGORY_META: Record<
  Score['category'],
  { label: string; emoji: string; color: string; description: string }
> = {
  bintang: {
    label: 'Bintang',
    emoji: '⭐',
    color: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    description: 'Laris + margin tinggi → pertahankan',
  },
  sapi_perah: {
    label: 'Sapi Perah',
    emoji: '🐄',
    color: 'border-blue-300 bg-blue-50 text-blue-800',
    description: 'Laris tapi margin tipis → naikkan harga',
  },
  tanda_tanya: {
    label: 'Tanda Tanya',
    emoji: '❓',
    color: 'border-amber-300 bg-amber-50 text-amber-800',
    description: 'Margin bagus tapi kurang laris → promosi',
  },
  anjing: {
    label: 'Anjing',
    emoji: '🐕',
    color: 'border-red-300 bg-red-50 text-red-800',
    description: 'Tidak laris + margin rendah → kandidat dihapus',
  },
};

export const dynamic = 'force-dynamic';

export default async function MenuScoringPage() {
  let scores: Score[] = [];
  let menuItems: MenuItem[] = [];
  let error: string | null = null;
  try {
    const [s, m] = await Promise.all([
      apiFetch<{ items: Score[] }>('/v1/ai/menu-scores'),
      apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
    ]);
    scores = s.items;
    menuItems = m.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat skor';
  }

  // Latest period only
  const latestPeriodEnd = scores[0]?.periodEnd;
  const latest = scores.filter((s) => s.periodEnd === latestPeriodEnd);
  const itemNames = new Map(menuItems.map((m) => [m.id, m.name]));

  const grouped: Record<Score['category'], Score[]> = {
    bintang: [],
    sapi_perah: [],
    tanda_tanya: [],
    anjing: [],
  };
  for (const s of latest) grouped[s.category].push(s);

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menu Performance Scoring</h1>
          <p className="text-sm text-slate-500">
            Klasifikasi BCG matrix — Bintang / Sapi Perah / Tanda Tanya / Anjing
          </p>
          {latestPeriodEnd ? (
            <p className="mt-1 text-xs text-slate-500">
              Periode: {latest[0]?.periodStart} → {latest[0]?.periodEnd}
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

      {latest.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold">Belum ada skor</h2>
          <p className="mt-1 text-sm text-slate-500">
            Butuh minimal 30 hari data penjualan. Klik tombol Refresh untuk hitung sekarang.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['bintang', 'sapi_perah', 'tanda_tanya', 'anjing'] as const).map((cat) => {
            const meta = CATEGORY_META[cat];
            const items = grouped[cat];
            return (
              <section key={cat} className={`rounded-xl border p-4 ${meta.color}`}>
                <header>
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <span aria-hidden>{meta.emoji}</span> {meta.label}
                    <span className="ml-auto text-sm opacity-70">{items.length} item</span>
                  </h2>
                  <p className="text-xs opacity-80">{meta.description}</p>
                </header>
                {items.length === 0 ? (
                  <p className="mt-3 text-sm opacity-70">Tidak ada item di kategori ini.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm">
                    {items.slice(0, 8).map((it) => (
                      <li
                        key={it.id}
                        className="rounded-md border border-white/60 bg-white/60 p-2"
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {itemNames.get(it.menuItemId) ?? '—'}
                          </span>
                          <span className="font-mono text-xs">{it.salesQuantity}× terjual</span>
                        </div>
                        <div className="mt-1 flex justify-between font-mono text-xs">
                          <span>Revenue {formatCurrency(BigInt(it.grossRevenue))}</span>
                          <span>Margin {formatCurrency(BigInt(it.grossMargin))}</span>
                        </div>
                        {it.rationale ? (
                          <p className="mt-1 text-xs italic opacity-80">{it.rationale}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
