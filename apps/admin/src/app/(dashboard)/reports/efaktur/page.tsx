'use client';

import { useState } from 'react';

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

export default function EfakturExportPage() {
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(isoDaysAgo(0));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Export e-Faktur (CSV)</h1>
        <p className="text-sm text-slate-500">
          Bulk export untuk upload ke aplikasi e-Faktur DJP. Hanya order paid dengan customer
          ber-NPWP yang dimasukkan.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Dari</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Sampai</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <a
          href={`/api/v1/efaktur/export.csv?from=${from}&to=${to}`}
          download
          className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          📥 Download CSV
        </a>

        <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
          <strong>Catatan:</strong> Tenant harus berstatus PKP &amp; punya NPWP terdaftar.
          Aktifkan modul <code>efaktur_b2b</code> di Pengaturan.
        </div>
      </section>
    </div>
  );
}
