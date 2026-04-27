'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewVoucherPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const type = fd.get('type') as string;
      const valueRupiah = Number(fd.get('value'));
      const value =
        type === 'percent'
          ? valueRupiah.toString()
          : BigInt(Math.round(valueRupiah * 100)).toString();
      const res = await fetch('/api/v1/vouchers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: fd.get('code'),
          name: fd.get('name'),
          type,
          value,
          minSubtotalRupiah: Number(fd.get('minSubtotalRupiah') ?? 0),
          maxUsages: Number(fd.get('maxUsages') ?? 0),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Gagal');
      }
      router.push('/vouchers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <Link href="/vouchers" className="text-sm text-emerald-700 hover:underline">
          ← Voucher
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Voucher baru</h1>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Field label="Kode" required>
          <input
            name="code"
            required
            pattern="[A-Z0-9_-]+"
            placeholder="HEMAT10"
            className="input"
            onInput={(e) => {
              e.currentTarget.value = e.currentTarget.value.toUpperCase();
            }}
          />
        </Field>
        <Field label="Nama" required>
          <input name="name" required placeholder="Diskon 10rb" className="input" />
        </Field>
        <Field label="Tipe" required>
          <select name="type" required defaultValue="percent" className="input">
            <option value="percent">Persen (%)</option>
            <option value="amount">Nominal (Rp)</option>
            <option value="happy_hour">Happy Hour</option>
          </select>
        </Field>
        <Field label="Nilai" required>
          <input
            type="number"
            name="value"
            required
            min="0"
            step="100"
            className="input"
            placeholder="10 (untuk %, atau 10000 untuk Rp)"
          />
        </Field>
        <Field label="Min order (Rp)">
          <input
            type="number"
            name="minSubtotalRupiah"
            min="0"
            step="1000"
            defaultValue="0"
            className="input"
          />
        </Field>
        <Field label="Maks pemakaian (0 = unlimited)">
          <input type="number" name="maxUsages" min="0" defaultValue="0" className="input" />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Menyimpan...' : 'Buat voucher'}
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
