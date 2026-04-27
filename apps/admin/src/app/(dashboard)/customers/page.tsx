import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phoneHash: string | null;
  visitCount: number;
  lastVisitAt: string | null;
  isActive: boolean;
};

export const dynamic = 'force-dynamic';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.q) params.set('q', sp.q);

  let items: Customer[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Customer[] }>(
      `/v1/customers${params.toString() ? `?${params.toString()}` : ''}`,
    );
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Aktifkan modul customer_directory';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pelanggan</h1>
          <p className="text-sm text-slate-500">{items.length} pelanggan</p>
        </div>
      </header>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Cari berdasarkan no. HP..."
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Cari
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Belum ada pelanggan tercatat.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Nama</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-right">Visit</th>
                <th className="px-4 py-2 text-right">Last Visit</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-2 text-right">{c.visitCount}</td>
                  <td className="px-4 py-2 text-right text-xs text-slate-500">
                    {c.lastVisitAt ? new Date(c.lastVisitAt).toLocaleDateString('id-ID') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
