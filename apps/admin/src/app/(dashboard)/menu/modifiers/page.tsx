import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Modifier = { id: string; name: string; priceDelta: string; isDefault: boolean };
type Group = {
  id: string;
  name: string;
  selectionMin: number;
  selectionMax: number;
  required: boolean;
  modifiers: Modifier[];
};

export const dynamic = 'force-dynamic';

export default async function ModifiersPage() {
  let items: Group[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Group[] }>('/v1/menu/modifier-groups');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/menu" className="text-sm text-emerald-700 hover:underline">
            ← Menu
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Modifier Groups</h1>
          <p className="text-sm text-slate-500">Topping, level pedas, ukuran porsi, dll.</p>
        </div>
        <Link
          href="/menu/modifiers/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Modifier group baru
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Belum ada modifier group.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((g) => (
            <article key={g.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold">{g.name}</h2>
                  <p className="text-xs text-slate-500">
                    Pilih {g.selectionMin}–{g.selectionMax} · {g.required ? 'Wajib' : 'Opsional'}
                  </p>
                </div>
                <Link
                  href={`/menu/modifiers/${g.id}`}
                  className="text-sm text-emerald-700 hover:underline"
                >
                  Ubah
                </Link>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {g.modifiers.map((m) => (
                  <li key={m.id} className="flex justify-between">
                    <span>
                      {m.name} {m.isDefault ? <span className="text-xs text-slate-500">(default)</span> : null}
                    </span>
                    <span className="font-mono text-xs">
                      {BigInt(m.priceDelta) === BigInt(0)
                        ? '—'
                        : (BigInt(m.priceDelta) > BigInt(0) ? '+' : '') +
                          formatCurrency(BigInt(m.priceDelta))}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
