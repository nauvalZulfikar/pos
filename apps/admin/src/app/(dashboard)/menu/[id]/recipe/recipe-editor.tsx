'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type InventoryItem = { id: string; name: string; unit: string; unitCost: string };

type Ingredient = { inventoryItemId: string; quantityMilli: string };

type Props = {
  menuItemId: string;
  inventory: InventoryItem[];
  initialIngredients: Ingredient[];
  initialAutoDeduct: boolean;
};

export function RecipeEditor({
  menuItemId,
  inventory,
  initialIngredients,
  initialAutoDeduct,
}: Props) {
  const router = useRouter();
  const [autoDeduct, setAutoDeduct] = useState(initialAutoDeduct);
  const [lines, setLines] = useState<Array<{ inventoryItemId: string; quantity: number }>>(() =>
    initialIngredients.map((i) => ({
      inventoryItemId: i.inventoryItemId,
      quantity: Number(i.quantityMilli) / 1000,
    })),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLine = () =>
    setLines((s) => [...s, { inventoryItemId: inventory[0]?.id ?? '', quantity: 0 }]);
  const removeLine = (idx: number) => setLines((s) => s.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<{ inventoryItemId: string; quantity: number }>) =>
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const save = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const ingredients = lines
        .filter((l) => l.inventoryItemId && l.quantity > 0)
        .map((l) => ({
          inventoryItemId: l.inventoryItemId,
          quantityMilli: BigInt(Math.round(l.quantity * 1000)).toString(),
        }));
      const res = await fetch(`/api/v1/recipes/menu/${menuItemId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ingredients, autoDeduct }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Gagal simpan');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!confirm('Hapus seluruh resep? Stok tidak akan auto-deduct lagi.')) return;
    setSubmitting(true);
    try {
      await fetch(`/api/v1/recipes/menu/${menuItemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const invById = new Map(inventory.map((i) => [i.id, i]));

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoDeduct}
          onChange={(e) => setAutoDeduct(e.target.checked)}
        />
        Auto-kurangi stok bahan baku saat order paid
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Bahan baku per 1 porsi</span>
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-emerald-700 hover:underline"
          >
            + Tambah bahan
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => {
            const inv = invById.get(l.inventoryItemId);
            return (
              <div key={idx} className="grid grid-cols-12 items-center gap-2">
                <select
                  value={l.inventoryItemId}
                  onChange={(e) => updateLine(idx, { inventoryItemId: e.target.value })}
                  className="col-span-6 rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Pilih bahan...</option>
                  {inventory.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.unit})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={l.quantity}
                  onChange={(e) =>
                    updateLine(idx, { quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-sm"
                />
                <span className="col-span-2 text-xs text-slate-500">
                  {inv?.unit ?? ''}
                </span>
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="col-span-1 text-red-600"
                >
                  ×
                </button>
              </div>
            );
          })}
          {lines.length === 0 ? (
            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
              Belum ada bahan. Klik "+ Tambah bahan".
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={remove}
          disabled={submitting || lines.length === 0}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40"
        >
          Hapus resep
        </button>
        <button
          type="button"
          onClick={save}
          disabled={submitting}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Menyimpan...' : 'Simpan resep'}
        </button>
      </div>
    </div>
  );
}
