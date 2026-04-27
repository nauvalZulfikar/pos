'use client';

import { useActionState } from 'react';
import type { OutletFormState } from './actions';

type Props = {
  action: (state: OutletFormState, formData: FormData) => Promise<OutletFormState>;
  defaults?: {
    name?: string;
    code?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    phone?: string;
    serviceChargeBps?: number;
    ppnBpsOverride?: number | null;
  };
  submitLabel?: string;
};

export function OutletForm({ action, defaults, submitLabel = 'Simpan' }: Props) {
  const [state, formAction, pending] = useActionState<OutletFormState, FormData>(action, {
    status: 'idle',
  });

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

      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama cabang" required>
          <input
            name="name"
            required
            defaultValue={defaults?.name ?? ''}
            className="input"
          />
        </Field>
        <Field label="Kode (huruf besar)" required>
          <input
            name="code"
            required
            pattern="[A-Z0-9_-]+"
            defaultValue={defaults?.code ?? ''}
            className="input"
          />
        </Field>
      </div>

      <Field label="Alamat" required>
        <input name="addressLine1" required defaultValue={defaults?.addressLine1 ?? ''} className="input" />
      </Field>
      <Field label="Alamat (lanjutan)">
        <input name="addressLine2" defaultValue={defaults?.addressLine2 ?? ''} className="input" />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Kota" required>
          <input name="city" required defaultValue={defaults?.city ?? ''} className="input" />
        </Field>
        <Field label="Provinsi" required>
          <input name="province" required defaultValue={defaults?.province ?? ''} className="input" />
        </Field>
        <Field label="Kode pos">
          <input name="postalCode" defaultValue={defaults?.postalCode ?? ''} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Telp">
          <input name="phone" defaultValue={defaults?.phone ?? ''} className="input" />
        </Field>
        <Field label="Service charge (bps)">
          <input
            type="number"
            name="serviceChargeBps"
            min="0"
            max="2500"
            defaultValue={defaults?.serviceChargeBps ?? 0}
            className="input"
          />
        </Field>
        <Field label="PPN override (bps, opsional)">
          <input
            type="number"
            name="ppnBpsOverride"
            min="0"
            max="2500"
            defaultValue={defaults?.ppnBpsOverride ?? ''}
            className="input"
          />
        </Field>
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

      <style jsx>{`
        :global(.input) {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
