'use client';

import { useActionState, useState } from 'react';
import { uuidv7 } from 'uuidv7';
import type { GroupFormState } from './actions';

type Line = {
  id?: string;
  name: string;
  priceDeltaRupiah: number;
  isDefault: boolean;
  sortOrder: number;
};

type Props = {
  action: (state: GroupFormState, formData: FormData) => Promise<GroupFormState>;
  defaults?: {
    name?: string;
    selectionMin?: number;
    selectionMax?: number;
    required?: boolean;
    modifiers?: Line[];
  };
  submitLabel?: string;
};

export function GroupForm({ action, defaults, submitLabel = 'Simpan' }: Props) {
  const [state, formAction, pending] = useActionState<GroupFormState, FormData>(action, {
    status: 'idle',
  });
  const [lines, setLines] = useState<Line[]>(
    defaults?.modifiers ?? [
      { id: uuidv7(), name: '', priceDeltaRupiah: 0, isDefault: false, sortOrder: 0 },
    ],
  );

  const addLine = () =>
    setLines((s) => [
      ...s,
      {
        id: uuidv7(),
        name: '',
        priceDeltaRupiah: 0,
        isDefault: false,
        sortOrder: s.length,
      },
    ]);
  const removeLine = (idx: number) => setLines((s) => s.filter((_, i) => i !== idx));
  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines((s) => s.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  return (
    <form action={formAction} className="space-y-5">
      {state.status === 'error' ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {state.message}
        </div>
      ) : null}
      {state.status === 'success' ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          Tersimpan.
        </div>
      ) : null}

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Nama group</span>
        <input
          name="name"
          required
          defaultValue={defaults?.name ?? ''}
          placeholder="Topping, Level Pedas, Ukuran..."
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Min pilih</span>
          <input
            type="number"
            name="selectionMin"
            min="0"
            defaultValue={defaults?.selectionMin ?? 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Max pilih</span>
          <input
            type="number"
            name="selectionMax"
            min="1"
            defaultValue={defaults?.selectionMax ?? 1}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex items-end gap-2 pb-2">
          <input type="checkbox" name="required" defaultChecked={defaults?.required ?? false} />
          <span className="text-sm">Wajib pilih</span>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Pilihan modifier</span>
          <button
            type="button"
            onClick={addLine}
            className="text-sm text-emerald-700 hover:underline"
          >
            + Tambah pilihan
          </button>
        </div>
        <div className="space-y-2">
          {lines.map((line, idx) => (
            <div key={line.id ?? idx} className="grid grid-cols-12 gap-2">
              <input
                type="hidden"
                name={`modifiers[${idx}].id`}
                value={line.id ?? ''}
              />
              <input
                type="hidden"
                name={`modifiers[${idx}].sortOrder`}
                value={idx}
              />
              <input
                name={`modifiers[${idx}].name`}
                required
                value={line.name}
                onChange={(e) => updateLine(idx, { name: e.target.value })}
                placeholder="Keju Mozza, Pedas Level 3..."
                className="col-span-6 rounded-md border border-slate-300 px-3 py-2"
              />
              <input
                type="number"
                step="500"
                name={`modifiers[${idx}].priceDeltaRupiah`}
                value={line.priceDeltaRupiah}
                onChange={(e) =>
                  updateLine(idx, { priceDeltaRupiah: Number(e.target.value) })
                }
                placeholder="Δ harga (Rp)"
                className="col-span-3 rounded-md border border-slate-300 px-3 py-2 text-right font-mono"
              />
              <label className="col-span-2 flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  name={`modifiers[${idx}].isDefault`}
                  checked={line.isDefault}
                  onChange={(e) => updateLine(idx, { isDefault: e.target.checked })}
                />
                Default
              </label>
              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="col-span-1 text-red-600 hover:bg-red-50"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Menyimpan...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
