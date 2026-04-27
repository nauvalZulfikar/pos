import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type Voucher = {
  id: string;
  code: string;
  name: string;
  type: 'percent' | 'amount' | 'happy_hour';
  value: string;
  minSubtotal: string;
  maxUsages: number;
  usedCount: number;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export const dynamic = 'force-dynamic';

export default async function VouchersPage() {
  let items: Voucher[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: Voucher[] }>('/v1/vouchers');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Voucher & Promo</h1>
          <p className="text-sm text-slate-500">{items.length} voucher</p>
        </div>
        <Link
          href="/vouchers/new"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Voucher baru
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500">Belum ada voucher.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Kode</th>
                <th className="px-4 py-2 text-left">Nama</th>
                <th className="px-4 py-2 text-left">Tipe</th>
                <th className="px-4 py-2 text-right">Nilai</th>
                <th className="px-4 py-2 text-right">Min order</th>
                <th className="px-4 py-2 text-right">Pemakaian</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 font-mono text-xs">{v.code}</td>
                  <td className="px-4 py-2">{v.name}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">{v.type}</td>
                  <td className="px-4 py-2 text-right">
                    {v.type === 'percent'
                      ? `${v.value}%`
                      : formatCurrency(BigInt(v.value))}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatCurrency(BigInt(v.minSubtotal))}
                  </td>
                  <td className="px-4 py-2 text-right text-xs">
                    {v.usedCount} / {v.maxUsages || '∞'}
                  </td>
                  <td className="px-4 py-2">
                    {v.isActive ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                        Aktif
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Nonaktif
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
