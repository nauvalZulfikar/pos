import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { createMenuItem } from '../actions';
import { MenuItemForm } from '../menu-form';

type Category = { id: string; name: string };

export const dynamic = 'force-dynamic';

export default async function NewMenuItemPage() {
  let categories: Category[] = [];
  try {
    const r = await apiFetch<{ items: Category[] }>('/v1/menu/categories');
    categories = r.items;
  } catch {
    /* leave empty */
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <Link href="/menu" className="text-sm text-emerald-700 hover:underline">
          ← Kembali ke menu
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Tambah Item Menu</h1>
      </header>

      {categories.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Belum ada kategori. Buat kategori dulu sebelum menambah item.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <MenuItemForm
            categories={categories}
            action={createMenuItem}
            submitLabel="Buat item"
          />
        </div>
      )}
    </div>
  );
}
