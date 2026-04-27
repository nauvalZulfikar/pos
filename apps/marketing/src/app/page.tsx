export default function Landing() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-16 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">DESAIN POS</h1>
        <p className="mt-4 text-xl text-slate-600">
          Sistem POS modular untuk restoran Indonesia. QRIS, GoFood, GrabFood, ShopeeFood, AI Daily
          Brief — bayar hanya untuk fitur yang dipakai.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <Pillar title="Offline-First" body="Kasir tetap jalan 8+ jam tanpa internet. Sinkronisasi otomatis saat online." />
        <Pillar title="QRIS Native" body="Terima GoPay, OVO, DANA, ShopeePay via 1 QR. Settlement langsung ke rekening." />
        <Pillar title="AI Insight" body="Daily Brief Bahasa Indonesia setiap pagi, dengan rekomendasi aksi yang konkret." />
      </section>

      <section className="mt-20 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-2xl font-semibold">À la carte pricing</h2>
        <p className="mt-2 text-slate-600">
          Mulai dari Rp 99.000/bulan. Tambah QRIS, integrasi delivery, AI brief — sesuai kebutuhan.
        </p>
        <a
          href="https://app.desain.id/signup"
          className="mt-6 inline-block rounded-lg bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Mulai uji coba 14 hari
        </a>
      </section>
    </main>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-xl border border-slate-200 p-6">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-slate-600">{body}</p>
    </article>
  );
}
