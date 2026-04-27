import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { deactivateStaff, setPin } from '../actions';

type StaffEntry = {
  membership: { id: string; role: string; isActive: boolean };
  user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    hasPin: boolean;
    isActive: boolean;
  } | null;
};

export const dynamic = 'force-dynamic';

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let entry: StaffEntry | undefined;
  try {
    const r = await apiFetch<{ items: StaffEntry[] }>('/v1/staff');
    entry = r.items.find((e) => e.user?.id === id);
  } catch {
    /* fall */
  }
  if (!entry?.user) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Link href="/staff" className="text-sm text-emerald-700 hover:underline">
          ← Tim
        </Link>
        <p className="mt-4 text-sm text-slate-500">Anggota tidak ditemukan.</p>
      </div>
    );
  }

  const setPinAction = setPin.bind(null, entry.user.id);
  const deactivate = deactivateStaff.bind(null, entry.user.id);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <header>
        <Link href="/staff" className="text-sm text-emerald-700 hover:underline">
          ← Tim
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{entry.user.fullName}</h1>
        <p className="text-sm text-slate-500">
          {entry.user.email} · {entry.membership.role}
        </p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">Reset PIN</h2>
        <form action={setPinAction} className="flex gap-2">
          <input
            name="pin"
            pattern="\d{4}"
            inputMode="numeric"
            maxLength={4}
            required
            placeholder="1234"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono text-lg"
          />
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Set PIN
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="mb-2 font-semibold text-red-900">Nonaktifkan akun</h2>
        <p className="mb-3 text-sm text-red-800">
          Anggota tidak bisa login lagi setelah dinonaktifkan.
        </p>
        <form action={deactivate}>
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Nonaktifkan
          </button>
        </form>
      </section>
    </div>
  );
}
