import { apiFetch } from '@/lib/api';

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  npwp: string | null;
  isActive: boolean;
};

export const dynamic = 'force-dynamic';

export default async function SuppliersPage() {
  let items: Supplier[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Supplier[] }>('/v1/suppliers');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Supplier</h1>
        <p className="text-sm text-slate-500">{items.length} supplier terdaftar</p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Belum ada supplier.</p>
          <p className="mt-2 text-xs text-slate-400">
            Aktifkan modul <code>supplier_management</code> di Pengaturan.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Nama</th>
                <th className="px-4 py-2 text-left">Kontak</th>
                <th className="px-4 py-2 text-left">Telp / Email</th>
                <th className="px-4 py-2 text-left">NPWP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2">{s.contactName ?? '—'}</td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {s.phone ?? '—'} {s.email ? `· ${s.email}` : ''}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.npwp ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
