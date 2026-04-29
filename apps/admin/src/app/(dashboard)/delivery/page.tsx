import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { LinkForm } from './link-form';
import { SyncButton } from './sync-button';

type Outlet = { id: string; name: string; code: string };
type PlatformLink = {
  id: string;
  outletId: string;
  platform: 'gofood' | 'grabfood' | 'shopeefood';
  externalMerchantId: string;
  syncStatus: string;
  lastSyncedAt: string | null;
};

const PLATFORM_META: Record<PlatformLink['platform'], { label: string; color: string }> = {
  gofood: { label: 'GoFood', color: 'bg-green-600' },
  grabfood: { label: 'GrabFood', color: 'bg-emerald-700' },
  shopeefood: { label: 'ShopeeFood', color: 'bg-orange-500' },
};

export const dynamic = 'force-dynamic';

export default async function DeliveryPage() {
  let outlets: Outlet[] = [];
  let links: PlatformLink[] = [];
  let error: string | null = null;
  try {
    const [o, l] = await Promise.all([
      apiFetch<{ items: Outlet[] }>('/v1/outlets'),
      apiFetch<{ items: PlatformLink[] }>('/v1/delivery/links'),
    ]);
    outlets = o.items;
    links = l.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  const outletById = new Map(outlets.map((o) => [o.id, o]));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Delivery Aggregator</h1>
          <p className="text-sm text-slate-500">
            Order dari GoFood, GrabFood, ShopeeFood masuk ke 1 KDS.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports/delivery-analytics"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            📊 Analytics
          </Link>
          <Link
            href="/reports/menu-margin"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            💰 Komisi vs Margin
          </Link>
          <SyncButton />
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Hubungkan Outlet ke Platform</h2>
        <LinkForm outlets={outlets} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-lg font-semibold">Link aktif</h2>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">
            Belum ada link platform. Tambah di form di atas (gunakan ID merchant dari portal partner
            masing-masing).
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 text-left">Outlet</th>
                <th className="py-2 text-left">Platform</th>
                <th className="py-2 text-left">External Merchant ID</th>
                <th className="py-2 text-left">Status sync</th>
                <th className="py-2 text-left">Last sync</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l) => {
                const meta = PLATFORM_META[l.platform];
                return (
                  <tr key={l.id} className="border-t border-slate-100">
                    <td className="py-2">
                      {outletById.get(l.outletId)?.name ?? l.outletId.slice(0, 8)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-white ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-xs">{l.externalMerchantId}</td>
                    <td className="py-2">
                      <StatusBadge status={l.syncStatus} />
                    </td>
                    <td className="py-2 text-xs text-slate-500">
                      {l.lastSyncedAt
                        ? new Date(l.lastSyncedAt).toLocaleString('id-ID')
                        : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    idle: 'bg-slate-100 text-slate-700',
    queued: 'bg-amber-100 text-amber-800',
    synced: 'bg-emerald-100 text-emerald-800',
    error: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${colors[status] ?? colors.idle}`}>
      {status}
    </span>
  );
}
