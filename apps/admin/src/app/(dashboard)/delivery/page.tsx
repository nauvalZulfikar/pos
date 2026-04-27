export const dynamic = 'force-dynamic';

const PLATFORMS = [
  { code: 'gofood_integration', name: 'GoFood', color: 'bg-green-600' },
  { code: 'grabfood_integration', name: 'GrabFood', color: 'bg-emerald-700' },
  { code: 'shopeefood_integration', name: 'ShopeeFood', color: 'bg-orange-500' },
] as const;

export default function DeliveryPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Delivery</h1>
        <p className="text-sm text-slate-500">
          Aggregator order dari GoFood, GrabFood, ShopeeFood dalam satu KDS.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PLATFORMS.map((p) => (
          <article key={p.code} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <span className={`h-3 w-3 rounded-full ${p.color}`} />
              <h2 className="font-semibold">{p.name}</h2>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              Belum tersambung. Aktifkan modul <code>{p.code}</code> dan masukkan kredensial
              partnership di Pengaturan.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-500"
            >
              Hubungkan (butuh kredensial)
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
