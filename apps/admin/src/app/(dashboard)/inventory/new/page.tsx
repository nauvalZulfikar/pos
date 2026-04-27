'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const res = await fetch('/api/v1/inventory/items', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: fd.get('name'),
          sku: fd.get('sku') || null,
          unit: fd.get('unit'),
          unitCostRupiah: Number(fd.get('unitCostRupiah')),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Gagal');
      }
      router.push('/inventory');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <Link href="/inventory" className="text-sm text-emerald-700 hover:underline">
          ← Stok
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Bahan baku baru</h1>
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

        <Field label="Nama bahan" required>
          <input name="name" required className="input" placeholder="Beras, Tepung, Cabai..." />
        </Field>

        <Field label="SKU (opsional)">
          <input name="sku" className="input" />
        </Field>

        <Field label="Unit" required>
          <select name="unit" required defaultValue="gram" className="input">
            <option value="gram">gram (g)</option>
            <option value="kilogram">kilogram (kg)</option>
            <option value="milliliter">milliliter (ml)</option>
            <option value="liter">liter (L)</option>
            <option value="piece">piece (pcs)</option>
            <option value="pack">pack</option>
          </select>
        </Field>

        <Field label="Harga per unit (Rp)" required>
          <input
            type="number"
            name="unitCostRupiah"
            min="0"
            step="100"
            required
            className="input"
            placeholder="500"
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Menyimpan...' : 'Simpan bahan'}
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
