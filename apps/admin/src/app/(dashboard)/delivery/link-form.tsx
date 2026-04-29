'use client';

import { useState } from 'react';
import { createDeliveryLink } from './actions';

type Outlet = { id: string; name: string; code: string };

export function LinkForm({ outlets }: { outlets: Outlet[] }) {
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
      await createDeliveryLink(fd);
      setState({ status: 'ok' });
      e.currentTarget.reset();
    } catch (err) {
      setState({ status: 'err', msg: err instanceof Error ? err.message : 'Gagal' });
    }
  };

  if (outlets.length === 0) {
    return (
      <p className="text-sm text-amber-700">
        Buat outlet dulu di /outlets/new sebelum hubungkan ke platform delivery.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <select
        name="outletId"
        required
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Pilih outlet…</option>
        {outlets.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <select
        name="platform"
        required
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      >
        <option value="">Pilih platform…</option>
        <option value="gofood">GoFood</option>
        <option value="grabfood">GrabFood</option>
        <option value="shopeefood">ShopeeFood</option>
      </select>
      <input
        name="externalMerchantId"
        required
        placeholder="External merchant ID"
        className="rounded border border-slate-300 px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={state.status === 'busy'}
        className="rounded bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {state.status === 'busy' ? '…' : 'Hubungkan'}
      </button>
      {state.status === 'ok' ? (
        <p className="md:col-span-4 text-sm text-emerald-700">✓ Link tersimpan.</p>
      ) : null}
      {state.status === 'err' ? (
        <p className="md:col-span-4 text-sm text-red-600">{state.msg}</p>
      ) : null}
    </form>
  );
}
