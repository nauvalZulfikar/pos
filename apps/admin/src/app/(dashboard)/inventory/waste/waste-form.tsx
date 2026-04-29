'use client';

import { useState } from 'react';
import { reportWaste } from './actions';

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

export function WasteForm({
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
    setState({ status: 'busy' });
    try {
      await reportWaste(fd);
      setState({ status: 'ok' });
      e.currentTarget.reset();
    } catch (err) {
      setState({ status: 'err', msg: err instanceof Error ? err.message : 'Gagal' });
    }
  };

  if (outlets.length === 0 || items.length === 0) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        {outlets.length === 0
          ? 'Belum ada cabang. Buat cabang dulu di /outlets/new.'
          : 'Belum ada bahan baku. Tambah dulu di /inventory/new.'}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
    >
      <h2 className="text-lg font-semibold">Catat Waste Baru</h2>

      <Field label="Cabang">
        <select
          name="outletId"
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

      <Field label="Jumlah terbuang (unit dasar)">
        <input
          name="quantity"
          type="number"
          step="any"
          min="0"
          required
          placeholder="contoh: 1.5"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-sm"
        />
      </Field>

      <Field label="Alasan (wajib)">
        <input
          name="reason"
          required
          minLength={3}
          maxLength={200}
          placeholder="contoh: tumpah, expired, gosong"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      {state.status === 'ok' ? (
        <p className="text-sm text-emerald-700">✓ Waste tercatat. Stok dikurangi otomatis.</p>
      ) : null}
      {state.status === 'err' ? <p className="text-sm text-red-600">{state.msg}</p> : null}

      <button
        type="submit"
        disabled={state.status === 'busy'}
        className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
      >
        {state.status === 'busy' ? 'Menyimpan...' : 'Catat Waste'}
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
