import { apiFetch } from '@/lib/api';

type AuditLog = {
  id: string;
  tenantId: string;
  actorUserId: string | null;
  actorRole: string | null;
  entityKind: string;
  entityId: string | null;
  operation: string;
  diff: unknown;
  reason: string | null;
  occurredAt: string;
};

export const dynamic = 'force-dynamic';

const OP_LABEL: Record<string, string> = {
  INSERT: 'Tambah',
  UPDATE: 'Ubah',
  DELETE: 'Hapus',
};

const ENTITY_LABEL: Record<string, string> = {
  orders: 'Order',
  order_items: 'Item order',
  payments: 'Pembayaran',
  payment_refunds: 'Refund',
  menu_items: 'Menu',
  memberships: 'Anggota tim',
  stock_movements: 'Pergerakan stok',
  tenant_features: 'Modul aktif',
  shifts: 'Shift',
  cash_movements: 'Pergerakan kas',
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; op?: string }>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  if (sp.entity) params.set('entityKind', sp.entity);
  if (sp.op) params.set('operation', sp.op);
  params.set('limit', '100');

  let items: AuditLog[] = [];
  let error: string | null = null;
  try {
    const r = await apiFetch<{ items: AuditLog[] }>(`/v1/audit/logs?${params.toString()}`);
    items = r.items;
  } catch (err) {
    error = err instanceof Error ? err.message : 'Gagal';
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Audit Log</h1>
        <p className="text-sm text-slate-500">
          Riwayat semua aksi penting (uang, stok, akses). Tidak bisa diedit/dihapus.
        </p>
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
              <th className="px-4 py-2 text-left">Waktu</th>
              <th className="px-4 py-2 text-left">Aksi</th>
              <th className="px-4 py-2 text-left">Entitas</th>
              <th className="px-4 py-2 text-left">Aktor</th>
              <th className="px-4 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  Belum ada aktivitas tercatat.
                </td>
              </tr>
            ) : (
              items.map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {new Date(log.occurredAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        log.operation === 'DELETE'
                          ? 'bg-red-100 text-red-800'
                          : log.operation === 'UPDATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {OP_LABEL[log.operation] ?? log.operation}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">
                      {ENTITY_LABEL[log.entityKind] ?? log.entityKind}
                    </div>
                    {log.entityId ? (
                      <div className="font-mono text-xs text-slate-400">
                        {log.entityId.slice(-8)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <div>{log.actorRole ?? '—'}</div>
                    {log.actorUserId ? (
                      <div className="font-mono text-xs text-slate-400">
                        {log.actorUserId.slice(-8)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-600 hover:text-slate-900">
                        Lihat diff
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-50 p-2 font-mono text-[10px]">
                        {JSON.stringify(log.diff, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
