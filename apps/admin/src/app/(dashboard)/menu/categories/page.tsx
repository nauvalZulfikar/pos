import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Category = { id: string; name: string; sortOrder: number; isActive: boolean };

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  let items: Category[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Category[] }>('/v1/menu/categories');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat kategori';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/menu" className="text-sm text-emerald-700 hover:underline">
            ← Menu
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">Kategori Menu</h1>
        </div>
        <Link
          href="/menu/categories/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Kategori baru
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Belum ada kategori.</p>
        </div>
      ) : (
        <ul className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {items.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"
            >
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-slate-500">Urutan: {c.sortOrder}</div>
              </div>
              <Link href={`/menu/categories/${c.id}`} className="text-sm text-emerald-700 hover:underline">
                Ubah
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
