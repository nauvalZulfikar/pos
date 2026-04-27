import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { updateMenuItem, deleteMenuItem } from '../actions';
import { MenuItemForm } from '../menu-form';

type Category = { id: string; name: string };
type MenuItem = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  sku: string | null;
  basePrice: string;
  imageUrl: string | null;
  ppnBpsOverride: number | null;
};

export const dynamic = 'force-dynamic';

export default async function EditMenuItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let categories: Category[] = [];
  let item: MenuItem | null = null;

  try {
    const [c, i] = await Promise.all([
      apiFetch<{ items: Category[] }>('/v1/menu/categories'),
      apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
    ]);
    categories = c.items;
    item = i.items.find((x) => x.id === id) ?? null;
  } catch {
    /* item stays null */
  }

  if (!item) notFound();

  const update = updateMenuItem.bind(null, item.id);
  const remove = deleteMenuItem.bind(null, item.id);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/menu" className="text-sm text-emerald-700 hover:underline">
            ← Kembali ke menu
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{item.name}</h1>
        </div>
        <form action={remove}>
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Hapus
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <MenuItemForm
          categories={categories}
          action={update}
          defaults={{
            categoryId: item.categoryId,
            name: item.name,
            description: item.description,
            sku: item.sku,
            basePriceRupiah: Number(BigInt(item.basePrice) / BigInt(100)),
            imageUrl: item.imageUrl,
            ppnBpsOverride: item.ppnBpsOverride,
          }}
          submitLabel="Simpan perubahan"
        />
      </div>
    </div>
  );
}
