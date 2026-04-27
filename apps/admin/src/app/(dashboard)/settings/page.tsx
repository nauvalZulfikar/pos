import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type LineItem = { code: string; price: string };
type Tier = { code: string; minSubtotal: string; discountBps: number };
type BillPreview = {
  lineItems: LineItem[];
  subtotal: string;
  tier: Tier;
  discountBps: number;
  discountAmount: string;
  total: string;
  unmetDependencies: { feature: string; missing: string[] }[];
};

const TIER_LABEL: Record<string, string> = {
  warung: 'Warung',
  cafe: 'Cafe',
  multi_cabang: 'Multi-Cabang',
  chain: 'Chain',
};

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  let bill: BillPreview | null = null;
  let error: string | null = null;
  try {
    bill = await apiFetch<BillPreview>('/v1/billing/preview');
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat preview tagihan';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Pengaturan</h1>
        <p className="text-sm text-slate-500">Modul aktif & preview tagihan bulanan.</p>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : bill ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="mb-1 text-lg font-semibold">Tagihan bulan ini</h2>
            <p className="mb-4 text-sm text-slate-500">
              Tier: <strong>{TIER_LABEL[bill.tier.code] ?? bill.tier.code}</strong> · Diskon:{' '}
              <strong>{(bill.discountBps / 100).toFixed(0)}%</strong>
            </p>

            {bill.lineItems.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada modul aktif.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {bill.lineItems.map((li) => (
                  <li key={li.code} className="flex justify-between py-2 text-sm">
                    <span className="font-mono text-xs text-slate-600">{li.code}</span>
                    <span className="font-mono">{formatCurrency(BigInt(li.price))}</span>
                  </li>
                ))}
              </ul>
            )}

            <dl className="mt-4 space-y-1 border-t border-slate-200 pt-4 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="font-mono">{formatCurrency(BigInt(bill.subtotal))}</dd>
              </div>
              {BigInt(bill.discountAmount) > BigInt(0) ? (
                <div className="flex justify-between text-emerald-700">
                  <dt>Bundling discount</dt>
                  <dd className="font-mono">
                    −{formatCurrency(BigInt(bill.discountAmount))}
                  </dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold">
                <dt>Total</dt>
                <dd className="font-mono">{formatCurrency(BigInt(bill.total))}</dd>
              </div>
            </dl>
          </section>

          {bill.unmetDependencies.length > 0 ? (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-6">
              <h2 className="mb-2 text-lg font-semibold text-amber-900">
                ⚠️ Hard dependency tidak lengkap
              </h2>
              <ul className="space-y-1 text-sm text-amber-800">
                {bill.unmetDependencies.map((d) => (
                  <li key={d.feature}>
                    <code>{d.feature}</code> butuh:{' '}
                    {d.missing.map((m, i) => (
                      <span key={m}>
                        {i > 0 ? ', ' : ''}
                        <code>{m}</code>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
