import Link from 'next/link';
import { createCategory } from '../actions';
import { CategoryForm } from '../category-form';

export const dynamic = 'force-dynamic';

export default function NewCategoryPage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <Link href="/menu/categories" className="text-sm text-emerald-700 hover:underline">
          ← Kategori
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Kategori baru</h1>
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <CategoryForm action={createCategory} submitLabel="Buat kategori" />
      </div>
    </div>
  );
}
