'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { inviteStaff, type InviteFormState } from '../actions';

export default function InvitePage() {
  const [state, action, pending] = useActionState<InviteFormState, FormData>(inviteStaff, {
    status: 'idle',
  });

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <Link href="/staff" className="text-sm text-emerald-700 hover:underline">
          ← Tim
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Undang anggota</h1>
      </header>

      <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        {state.status === 'error' ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {state.message}
          </div>
        ) : null}

        <Field label="Nama lengkap" required>
          <input name="fullName" required className="input" />
        </Field>
        <Field label="Email" required>
          <input type="email" name="email" required className="input" />
        </Field>
        <Field label="No. HP">
          <input name="phone" placeholder="+628xxx" className="input" />
        </Field>
        <Field label="Role" required>
          <select name="role" required defaultValue="kasir" className="input">
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="kasir">Kasir</option>
            <option value="dapur">Dapur</option>
          </select>
        </Field>
        <Field label="PIN 4 digit (untuk kasir)">
          <input
            name="pin"
            pattern="\d{4}"
            placeholder="1234"
            className="input"
            inputMode="numeric"
            maxLength={4}
          />
        </Field>
        <Field label="Password (untuk owner/manager)">
          <input
            type="password"
            name="password"
            minLength={8}
            placeholder="min 8 karakter"
            className="input"
          />
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? 'Mengundang...' : 'Undang'}
        </button>

        <style jsx>{`
          :global(.input) {
            width: 100%;
            border-radius: 0.375rem;
            border: 1px solid #cbd5e1;
            padding: 0.5rem 0.75rem;
          }
        `}</style>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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
