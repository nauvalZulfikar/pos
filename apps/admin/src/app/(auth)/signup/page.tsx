'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    legalName: '',
    displayName: '',
    segment: 'cafe',
    isPkp: false,
    npwp: '',
    ownerEmail: '',
    ownerName: '',
    ownerPhone: '',
    password: '',
    outletName: '',
    outletCode: '',
    outletAddress: '',
    outletCity: '',
    outletProvince: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...form,
          npwp: form.npwp || null,
          ownerPhone: form.ownerPhone || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Pendaftaran gagal');
      }
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal');
    } finally {
      setSubmitting(false);
    }
  };

  const update = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-6">
        <Link href="/login" className="text-sm text-emerald-700 hover:underline">
          ← Sudah punya akun? Masuk
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Daftar DESAIN POS</h1>
        <p className="text-sm text-slate-500">Free trial 30 hari, tanpa kartu kredit.</p>
      </header>

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Tentang restoran</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama legal (PT/CV/perorangan)" required>
              <input
                value={form.legalName}
                onChange={(e) => update('legalName', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Nama tampil (di struk)" required>
              <input
                value={form.displayName}
                onChange={(e) => update('displayName', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Segmen">
              <select
                value={form.segment}
                onChange={(e) => update('segment', e.target.value)}
                className="input"
              >
                <option value="warung">Warung / UMKM</option>
                <option value="cafe">Cafe / Resto Single</option>
                <option value="multi_cabang">Multi-Cabang (2-5)</option>
                <option value="chain">Chain (6+)</option>
              </select>
            </Field>
            <Field label="NPWP (opsional, untuk PKP)">
              <input
                value={form.npwp}
                onChange={(e) => update('npwp', e.target.value)}
                placeholder="15-16 digit"
                className="input"
              />
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isPkp}
                onChange={(e) => update('isPkp', e.target.checked)}
              />
              Pengusaha Kena Pajak (PKP) — wajib pungut PPN 11%
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Akun owner</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama lengkap" required>
              <input
                value={form.ownerName}
                onChange={(e) => update('ownerName', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => update('ownerEmail', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="No. HP (opsional)">
              <input
                value={form.ownerPhone}
                onChange={(e) => update('ownerPhone', e.target.value)}
                placeholder="+628xxx"
                className="input"
              />
            </Field>
            <Field label="Password (min 8 karakter)" required>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={8}
                className="input"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">Cabang pertama</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama cabang" required>
              <input
                value={form.outletName}
                onChange={(e) => update('outletName', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Kode cabang (huruf besar)" required>
              <input
                value={form.outletCode}
                onChange={(e) => update('outletCode', e.target.value.toUpperCase())}
                required
                pattern="[A-Z0-9_-]+"
                placeholder="PUSAT"
                className="input"
              />
            </Field>
            <Field label="Alamat" required className="col-span-2">
              <input
                value={form.outletAddress}
                onChange={(e) => update('outletAddress', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Kota" required>
              <input
                value={form.outletCity}
                onChange={(e) => update('outletCity', e.target.value)}
                required
                className="input"
              />
            </Field>
            <Field label="Provinsi" required>
              <input
                value={form.outletProvince}
                onChange={(e) => update('outletProvince', e.target.value)}
                required
                className="input"
              />
            </Field>
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Mendaftarkan...' : 'Daftar gratis'}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 0.375rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
        }
        .input:focus {
          outline: none;
          border-color: #10b981;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  required,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
