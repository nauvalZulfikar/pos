import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  unitCost: string;
  isActive: boolean;
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

export default async function InventoryPage() {
  let items: InventoryItem[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: InventoryItem[] }>('/v1/inventory/items');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat stok';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Stok</h1>
          <p className="text-sm text-slate-500">{items.length} bahan baku</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/inventory/adjust"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ± Sesuaikan
          </Link>
          <Link
            href="/inventory/transfer"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ⇄ Transfer
          </Link>
          <Link
            href="/inventory/waste"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            🗑️ Waste
          </Link>
          <Link
            href="/inventory/new"
            className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Bahan baru
          </Link>
        </div>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <h2 className="text-lg font-semibold">Belum ada bahan baku</h2>
          <p className="mt-1 text-sm text-slate-500">
            Aktifkan modul <code>inventory_recipe</code> di Pengaturan, lalu mulai input bahan.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Nama</th>
                <th className="px-4 py-2 text-left">SKU</th>
                <th className="px-4 py-2 text-left">Unit</th>
                <th className="px-4 py-2 text-right">Cost / unit</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-medium">{it.name}</td>
                  <td className="px-4 py-2 text-slate-500">{it.sku ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">{UNIT_LABEL[it.unit] ?? it.unit}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(BigInt(it.unitCost))}
                  </td>
                  <td className="px-4 py-2">
                    {it.isActive ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Nonaktif
                      </span>
                    )}
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
