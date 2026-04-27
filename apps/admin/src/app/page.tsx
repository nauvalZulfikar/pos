import Link from 'next/link';

export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-semibold">DESAIN POS Admin</h1>
      <p className="text-center text-slate-600">
        Multi-tenant SaaS POS untuk restoran Indonesia.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-md bg-emerald-600 px-5 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          Masuk
        </Link>
        <Link
          href="/overview"
          className="rounded-md border border-slate-300 bg-white px-5 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
        >
          Dashboard (dev)
        </Link>
      </div>
    </main>
  );
}
