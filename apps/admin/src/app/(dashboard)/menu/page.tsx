import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  basePrice: string;
  sku: string | null;
  isActive: boolean;
  imageUrl: string | null;
};

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  let categories: Category[] = [];
  let items: MenuItem[] = [];
  let error: string | null = null;
  try {
    const [c, i] = await Promise.all([
      apiFetch<{ items: Category[] }>('/v1/menu/categories'),
      apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
    ]);
    categories = c.items;
    items = i.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat menu';
  }

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const it of items) {
    const arr = itemsByCategory.get(it.categoryId) ?? [];
    arr.push(it);
    itemsByCategory.set(it.categoryId, arr);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Menu</h1>
          <p className="text-sm text-slate-500">
            {items.length} item · {categories.length} kategori
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/menu/categories"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Kategori
          </Link>
          <Link
            href="/menu/modifiers"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Modifier
          </Link>
          <Link
            href="/menu/new"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Item baru
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {categories.length === 0 && !error ? (
        <EmptyState />
      ) : (
        <div className="space-y-6">
          {categories.map((cat) => (
            <section key={cat.id} className="rounded-xl border border-slate-200 bg-white">
              <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold">{cat.name}</h2>
                <span className="text-xs text-slate-500">
                  {(itemsByCategory.get(cat.id) ?? []).length} item
                </span>
              </header>
              <ul>
                {(itemsByCategory.get(cat.id) ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-3 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded bg-slate-100" />
                      )}
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-slate-500">
                          {item.sku ?? '—'} · {item.isActive ? 'Aktif' : 'Tidak aktif'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">
                        {formatCurrency(BigInt(item.basePrice))}
                      </span>
                      <Link
                        href={`/menu/${item.id}`}
                        className="text-sm text-emerald-700 hover:underline"
                      >
                        Ubah
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
      <h2 className="text-lg font-semibold">Belum ada menu</h2>
      <p className="mt-1 text-sm text-slate-500">
        Mulai dengan membuat kategori, lalu tambahkan item menu.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Link
          href="/menu/categories/new"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          + Kategori
        </Link>
        <Link
          href="/menu/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Item menu
        </Link>
      </div>
    </div>
  );
}
