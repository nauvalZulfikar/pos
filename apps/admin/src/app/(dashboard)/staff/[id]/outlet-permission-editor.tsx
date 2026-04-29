'use client';

import { useState } from 'react';
import { setOutletPermissions } from '../actions';

type Outlet = { id: string; name: string; code: string };
type Override = { outletId: string; permissions: string[] };

const ALL_PERMS = [
  'order:create',
  'order:edit',
  'order:void',
  'order:apply_discount',
  'payment:record',
  'payment:refund',
  'menu:edit',
  'inventory:read',
  'inventory:adjust',
  'reports:view',
  'reports:export',
  'shift:open',
  'shift:close',
  'staff:manage',
  'settings:edit',
] as const;

export function OutletPermissionEditor({
  userId,
  outlets,
  initial,
}: {
  userId: string;
  outlets: Outlet[];
  initial: Override[];
}) {
  const [overrides, setOverrides] = useState<Override[]>(initial);
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');

  const ovByOutlet = new Map(overrides.map((o) => [o.outletId, o.permissions]));

  const togglePerm = (outletId: string, perm: string) => {
    const current = ovByOutlet.get(outletId) ?? [];
    const next = current.includes(perm)
      ? current.filter((p) => p !== perm)
      : [...current, perm];
    const others = overrides.filter((o) => o.outletId !== outletId);
    setOverrides(next.length > 0 ? [...others, { outletId, permissions: next }] : others);
  };

  const onSave = async () => {
    setState('busy');
    try {
      await setOutletPermissions(userId, overrides);
      setState('ok');
      setTimeout(() => setState('idle'), 1500);
    } catch {
      setState('err');
    }
  };

  if (outlets.length === 0) {
    return <p className="text-sm text-slate-500">Belum ada cabang.</p>;
  }

  return (
    <div className="space-y-4">
      <details className="group rounded-md border border-slate-200">
        <summary className="cursor-pointer bg-slate-50 px-3 py-2 text-sm font-medium">
          {overrides.length} cabang dengan override aktif — klik untuk edit
        </summary>
        <div className="space-y-4 p-3">
          {outlets.map((o) => {
            const perms = ovByOutlet.get(o.id) ?? [];
            return (
              <div key={o.id} className="rounded-md border border-slate-100 p-3">
                <h3 className="mb-2 font-semibold">
                  {o.name} <span className="text-xs text-slate-500">({o.code})</span>
                </h3>
                <div className="grid grid-cols-2 gap-1 md:grid-cols-3">
                  {ALL_PERMS.map((p) => (
                    <label key={p} className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={perms.includes(p)}
                        onChange={() => togglePerm(o.id, p)}
                      />
                      <span className="font-mono">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </details>
      <button
        onClick={onSave}
        disabled={state === 'busy'}
        className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {state === 'busy'
          ? 'Menyimpan…'
          : state === 'ok'
          ? '✓ Tersimpan'
          : state === 'err'
          ? '✗ Gagal'
          : 'Simpan override'}
      </button>
    </div>
  );
}
