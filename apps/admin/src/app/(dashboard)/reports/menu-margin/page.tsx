import { apiFetch } from '@/lib/api';
import { formatCurrency } from '@/lib/format';

type MarginItem = {
  menuItemId: string;
  name: string;
  menuPrice: string;
  recipeCost: string;
  commissionAmount: string;
  netReceived: string;
  marginAmount: string;
  marginBps: number;
};
type MarginResponse = {
  platform: string;
  commissionBps: number;
  items: MarginItem[];
};

const PLATFORMS = [
  { code: 'gofood', label: 'GoFood' },
  { code: 'grabfood', label: 'GrabFood' },
  { code: 'shopeefood', label: 'ShopeeFood' },
] as const;

export const dynamic = 'force-dynamic';

export default async function MenuMarginPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const sp = await searchParams;
  const platform = (sp.platform ?? 'gofood') as 'gofood' | 'grabfood' | 'shopeefood';

  let data: MarginResponse | null = null;
  let error: string | null = null;
  try {
    data = await apiFetch<MarginResponse>(`/v1/delivery/margin?platform=${platform}`);
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal memuat data';
  }

  const losing = data ? data.items.filter((i) => BigInt(i.marginAmount) < BigInt(0)) : [];
  const sorted = data ? [...data.items].sort((a, b) => a.marginBps - b.marginBps) : [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Komisi vs Margin per Menu</h1>
        <p className="text-sm text-slate-500">
          Margin aktual setelah dikurangi komisi platform — identifikasi item yang rugi via delivery.
        </p>
      </header>

      <form className="flex gap-2 rounded-lg border border-slate-200 bg-white p-3">
        <label className="text-sm">
          <span className="mr-2 text-slate-600">Platform:</span>
          <select
            name="platform"
            defaultValue={platform}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p.code} value={p.code}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white">
          Tampilkan
        </button>
      </form>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : data ? (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Tile
              label="Komisi Platform"
              value={`${(data.commissionBps / 100).toFixed(1)}%`}
              tone="neutral"
            />
            <Tile
              label="Item rugi via delivery"
              value={`${losing.length} dari ${data.items.length}`}
              tone={losing.length > 0 ? 'bad' : 'good'}
            />
            <Tile
              label="Total item dievaluasi"
              value={data.items.length.toString()}
              tone="neutral"
            />
          </section>

          {losing.length > 0 ? (
            <div className="rounded-md border-l-4 border-red-500 bg-red-50 p-4 text-sm text-red-800">
              <strong>{losing.length} item rugi</strong> jika dijual via {platform}. Pertimbangkan
              naikkan harga delivery atau hapus dari menu platform ini:
              <ul className="mt-2 list-inside list-disc">
                {losing.slice(0, 5).map((i) => (
                  <li key={i.menuItemId}>
                    {i.name} — margin {formatCurrency(BigInt(i.marginAmount))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Menu</th>
                  <th className="px-4 py-2 text-right">Harga jual</th>
                  <th className="px-4 py-2 text-right">Cost bahan</th>
                  <th className="px-4 py-2 text-right">Komisi</th>
                  <th className="px-4 py-2 text-right">Net diterima</th>
                  <th className="px-4 py-2 text-right">Margin</th>
                  <th className="px-4 py-2 text-right">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((it) => {
                  const margin = BigInt(it.marginAmount);
                  const isLoss = margin < BigInt(0);
                  return (
                    <tr
                      key={it.menuItemId}
                      className={`border-t border-slate-100 ${isLoss ? 'bg-red-50' : ''}`}
                    >
                      <td className="px-4 py-2 font-medium">{it.name}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatCurrency(BigInt(it.menuPrice))}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatCurrency(BigInt(it.recipeCost))}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">
                        −{formatCurrency(BigInt(it.commissionAmount))}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {formatCurrency(BigInt(it.netReceived))}
                      </td>
                      <td
                        className={`px-4 py-2 text-right font-mono font-semibold ${
                          isLoss ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {formatCurrency(margin)}
                      </td>
                      <td className="px-4 py-2 text-right text-xs">
                        {(it.marginBps / 100).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'good' | 'bad' | 'neutral';
}) {
  const colors = {
    good: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    bad: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-slate-200 bg-white text-slate-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <p className="text-xs uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
