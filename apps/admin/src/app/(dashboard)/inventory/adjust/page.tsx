import { apiFetch } from '@/lib/api';
import { AdjustForm } from './adjust-form';

type Outlet = { id: string; name: string; code: string };
type InventoryItem = { id: string; name: string; unit: string };

export const dynamic = 'force-dynamic';

export default async function InventoryAdjustPage() {
  let outlets: Outlet[] = [];
  let items: InventoryItem[] = [];
  let error: string | null = null;
  try {
    const [o, i] = await Promise.all([
      apiFetch<{ items: Outlet[] }>('/v1/outlets'),
      apiFetch<{ items: InventoryItem[] }>('/v1/inventory/items'),
    ]);
    outlets = o.items;
    items = i.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Sesuaikan Stok</h1>
        <p className="text-sm text-slate-500">
          Catat penambahan, pengurangan, atau koreksi stok dengan alasan.
        </p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <AdjustForm outlets={outlets} items={items} />
      )}
    </div>
  );
}
