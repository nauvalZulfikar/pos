import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { deleteCategory, updateCategory } from '../actions';
import { CategoryForm } from '../category-form';

type Category = { id: string; name: string; sortOrder: number; isActive: boolean };

export const dynamic = 'force-dynamic';

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let cat: Category | null = null;
  try {
    const r = await apiFetch<{ items: Category[] }>('/v1/menu/categories');
    cat = r.items.find((x) => x.id === id) ?? null;
  } catch {
    /* fallthrough */
  }
  if (!cat) notFound();

  const update = updateCategory.bind(null, cat.id);
  const remove = deleteCategory.bind(null, cat.id);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/menu/categories" className="text-sm text-emerald-700 hover:underline">
            ← Kategori
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{cat.name}</h1>
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
        <CategoryForm
          action={update}
          defaults={{ name: cat.name, sortOrder: cat.sortOrder }}
          submitLabel="Simpan perubahan"
        />
      </div>
    </div>
  );
}
