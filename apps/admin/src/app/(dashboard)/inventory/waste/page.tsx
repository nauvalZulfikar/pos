import { apiFetch } from '@/lib/api';
import { WasteForm } from './waste-form';

type Outlet = { id: string; name: string; code: string };
type InventoryItem = { id: string; name: string; unit: string };
type WasteEvent = {
  id: string;
  outletId: string;
  inventoryItemId: string;
  quantityMilli: string;
  reason: string;
  reportedAt: string;
};

const UNIT_LABEL: Record<string, string> = {
  gram: 'g',
  kilogram: 'kg',
  milliliter: 'ml',
  liter: 'L',
  piece: 'pcs',
  pack: 'pack',
};

export const dynamic = 'force-dynamic';

export default async function WastePage() {
  let outlets: Outlet[] = [];
  let items: InventoryItem[] = [];
  let events: WasteEvent[] = [];
  let error: string | null = null;
  try {
    const [o, i, e] = await Promise.all([
      apiFetch<{ items: Outlet[] }>('/v1/outlets'),
      apiFetch<{ items: InventoryItem[] }>('/v1/inventory/items'),
      apiFetch<{ items: WasteEvent[] }>('/v1/waste'),
    ]);
    outlets = o.items;
    items = i.items;
    events = e.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  const outletById = new Map(outlets.map((o) => [o.id, o]));
  const itemById = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Waste Tracking</h1>
        <p className="text-sm text-slate-500">
          Catat bahan terbuang harian untuk monitoring food cost aktual.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WasteForm outlets={outlets} items={items} />

        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-semibold">Riwayat Waste (terbaru)</h2>
          {events.length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada waste tercatat.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {events.slice(0, 30).map((e) => {
                const outlet = outletById.get(e.outletId);
                const item = itemById.get(e.inventoryItemId);
                const qty = Number(BigInt(e.quantityMilli)) / 1000;
                return (
                  <li key={e.id} className="flex items-start justify-between py-2">
                    <div>
                      <p className="font-medium">
                        {item?.name ?? '—'}{' '}
                        <span className="font-mono text-slate-500">
                          {qty} {UNIT_LABEL[item?.unit ?? ''] ?? item?.unit ?? ''}
                        </span>
                      </p>
                      <p className="text-xs text-slate-500">
                        {outlet?.name ?? '—'} · {new Date(e.reportedAt).toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-slate-600">Alasan: {e.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
