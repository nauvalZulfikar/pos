import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type Outlet = {
  id: string;
  name: string;
  code: string;
  city: string;
  province: string;
  isActive: boolean;
  serviceChargeBps: number;
};

export const dynamic = 'force-dynamic';

export default async function OutletsPage() {
  let items: Outlet[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Outlet[] }>('/v1/outlets');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Cabang</h1>
          <p className="text-sm text-slate-500">{items.length} cabang aktif</p>
        </div>
        <Link
          href="/outlets/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Cabang baru
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((o) => (
          <article key={o.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{o.name}</h2>
                <p className="text-xs text-slate-500">
                  Kode: <code>{o.code}</code> · {o.city}, {o.province}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Service: {(o.serviceChargeBps / 100).toFixed(1)}%
                </p>
              </div>
              <Link href={`/outlets/${o.id}`} className="text-sm text-emerald-700 hover:underline">
                Ubah
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
