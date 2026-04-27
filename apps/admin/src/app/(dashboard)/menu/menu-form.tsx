'use client';

import { useActionState } from 'react';
import type { MenuItemFormState } from './actions';

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  action: (state: MenuItemFormState, formData: FormData) => Promise<MenuItemFormState>;
  defaults?: {
    categoryId?: string;
    name?: string;
    description?: string | null;
    sku?: string | null;
    basePriceRupiah?: number;
    imageUrl?: string | null;
    ppnBpsOverride?: number | null;
  };
  submitLabel?: string;
};

export function MenuItemForm({ categories, action, defaults, submitLabel = 'Simpan' }: Props) {
  const [state, formAction, pending] = useActionState<MenuItemFormState, FormData>(action, { status: 'idle' });

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

      <Field label="Kategori" error={fe.categoryId}>
        <select
          name="categoryId"
          defaultValue={defaults?.categoryId ?? categories[0]?.id ?? ''}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Nama" error={fe.name}>
        <input
          name="name"
          required
          defaultValue={defaults?.name ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </Field>

      <Field label="Deskripsi (opsional)" error={fe.description}>
        <textarea
          name="description"
          rows={2}
          defaultValue={defaults?.description ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU (opsional)" error={fe.sku}>
          <input
            name="sku"
            defaultValue={defaults?.sku ?? ''}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </Field>
        <Field label="Harga (Rp)" error={fe.basePriceRupiah}>
          <input
            type="number"
            name="basePriceRupiah"
            min="0"
            step="100"
            required
            defaultValue={defaults?.basePriceRupiah ?? 0}
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
        </Field>
      </div>

      <Field label="URL gambar (opsional)" error={fe.imageUrl}>
        <input
          type="url"
          name="imageUrl"
          defaultValue={defaults?.imageUrl ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </Field>

      <Field
        label="Override PPN (bps, kosongkan = pakai default tenant)"
        error={fe.ppnBpsOverride}
      >
        <input
          type="number"
          name="ppnBpsOverride"
          min="0"
          max="2500"
          defaultValue={defaults?.ppnBpsOverride ?? ''}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
