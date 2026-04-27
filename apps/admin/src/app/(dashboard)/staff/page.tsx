import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type StaffEntry = {
  membership: { id: string; role: string; isActive: boolean };
  user: { id: string; email: string; fullName: string; phone: string | null; hasPin: boolean; isActive: boolean } | null;
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  kasir: 'Kasir',
  dapur: 'Dapur',
};

export const dynamic = 'force-dynamic';

export default async function StaffPage() {
  let items: StaffEntry[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: StaffEntry[] }>('/v1/staff');
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tim & Karyawan</h1>
          <p className="text-sm text-slate-500">{items.length} anggota</p>
        </div>
        <Link
          href="/staff/invite"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + Undang anggota
        </Link>
      </header>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Nama</th>
              <th className="px-4 py-2 text-left">Email</th>
              <th className="px-4 py-2 text-left">Role</th>
              <th className="px-4 py-2 text-left">PIN</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.membership.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium">{s.user?.fullName ?? '—'}</td>
                <td className="px-4 py-2 text-slate-600">{s.user?.email ?? '—'}</td>
                <td className="px-4 py-2">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                    {ROLE_LABEL[s.membership.role] ?? s.membership.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {s.user?.hasPin ? (
                    <span className="text-emerald-700">●●●●</span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {s.membership.isActive ? (
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                      Aktif
                    </span>
                  ) : (
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      Nonaktif
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  {s.user ? (
                    <Link
                      href={`/staff/${s.user.id}`}
                      className="text-sm text-emerald-700 hover:underline"
                    >
                      Edit
                    </Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
