'use client';

import { useState } from 'react';
import { transferStock } from './actions';

type Outlet = { id: string; name: string; code: string };
type InventoryItem = { id: string; name: string; unit: string };

const UNIT_LABEL: Record<string, string> = {
  gram: 'g',
  kilogram: 'kg',
  milliliter: 'ml',
  liter: 'L',
  piece: 'pcs',
  pack: 'pack',
};

export function TransferForm({
  outlets,
  items,
}: {
  outlets: Outlet[];
  items: InventoryItem[];
}) {
  const [state, setState] = useState<
    | { status: 'idle' }
    | { status: 'busy' }
    | { status: 'ok' }
    | { status: 'err'; msg: string }
  >({ status: 'idle' });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (fd.get('fromOutletId') === fd.get('toOutletId')) {
      setState({ status: 'err', msg: 'Outlet asal & tujuan harus berbeda.' });
      return;
    }
    setState({ status: 'busy' });
    try {
      await transferStock(fd);
      setState({ status: 'ok' });
      e.currentTarget.reset();
    } catch (err) {
      setState({ status: 'err', msg: err instanceof Error ? err.message : 'Gagal' });
    }
  };

  if (outlets.length < 2) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Butuh minimal 2 cabang untuk transfer. Buat cabang lagi di /outlets/new.
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <Field label="Cabang asal">
        <select
          name="fromOutletId"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Cabang tujuan">
        <select
          name="toOutletId"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Bahan baku">
        <select
          name="inventoryItemId"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name} ({UNIT_LABEL[i.unit] ?? i.unit})
            </option>
          ))}
        </select>
      </Field>

      <Field label="Jumlah (unit dasar)">
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-sm"
        />
      </Field>

      <Field label="Alasan">
        <input
          name="reason"
          required
          minLength={3}
          maxLength={200}
          placeholder="contoh: rebalance stok, restock cabang B"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      {state.status === 'ok' ? (
        <p className="text-sm text-emerald-700">✓ Transfer berhasil. Stok di kedua cabang ter-update.</p>
      ) : null}
      {state.status === 'err' ? <p className="text-sm text-red-600">{state.msg}</p> : null}

      <button
        type="submit"
        disabled={state.status === 'busy'}
        className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {state.status === 'busy' ? 'Memproses...' : 'Transfer'}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
