'use client';

import { useActionState } from 'react';
import type { CategoryFormState } from './actions';

type Props = {
  action: (state: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  defaults?: { name?: string; sortOrder?: number };
  submitLabel?: string;
};

export function CategoryForm({ action, defaults, submitLabel = 'Simpan' }: Props) {
  const [state, formAction, pending] = useActionState<CategoryFormState, FormData>(action, {
    status: 'idle',
  });
  const fe = state.status === 'error' ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="space-y-4">
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
        <span className="mb-1 block text-sm font-medium text-slate-700">Nama kategori</span>
        <input
          name="name"
          required
          defaultValue={defaults?.name ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
        {fe.name ? <span className="mt-1 block text-xs text-red-600">{fe.name}</span> : null}
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Urutan tampil</span>
        <input
          type="number"
          name="sortOrder"
          min="0"
          defaultValue={defaults?.sortOrder ?? 0}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

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
