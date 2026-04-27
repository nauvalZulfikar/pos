import { useMemo } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@desain/ui';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useOrderDraftStore } from '../stores/order.js';

type Table = {
  id: string;
  outletId: string;
  label: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
};

const STATUS_STYLE: Record<Table['status'], string> = {
  available: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  occupied: 'bg-orange-50 border-orange-300 text-orange-800',
  reserved: 'bg-blue-50 border-blue-300 text-blue-800',
  cleaning: 'bg-slate-100 border-slate-300 text-slate-600',
};

const STATUS_LABEL: Record<Table['status'], string> = {
  available: 'Kosong',
  occupied: 'Terisi',
  reserved: 'Reservasi',
  cleaning: 'Bersih-bersih',
};

export function TablesScreen() {
  const intl = useIntl();
  const nav = useNavigate();
  const qc = useQueryClient();
  const setTable = useOrderDraftStore((s) => s.setTable);

  const tablesQ = useQuery({
    queryKey: ['tables'],
    queryFn: () => apiFetch<{ items: Table[] }>('/v1/tables'),
    refetchInterval: 10_000,
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Table['status'] }) =>
      apiFetch(`/v1/tables/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  });

  const grouped = useMemo(() => {
    const items = tablesQ.data?.items ?? [];
    return [...items].sort((a, b) => a.label.localeCompare(b.label, 'id', { numeric: true }));
  }, [tablesQ.data]);

  const handleSelect = (table: Table) => {
    if (table.status === 'available') {
      setTable(table.id);
      setStatus.mutate({ id: table.id, status: 'occupied' });
      nav('/order');
    } else if (table.status === 'cleaning') {
      setStatus.mutate({ id: table.id, status: 'available' });
    }
  };

  if (tablesQ.isLoading) {
    return (
      <div className="grid h-full place-items-center text-slate-500">
        <FormattedMessage id="common.loading" />
      </div>
    );
  }

  if (tablesQ.isError) {
    return (
      <div className="grid h-full place-items-center text-red-600">
        {intl.formatMessage({ id: 'common.error' })}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-slate-50 p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          <FormattedMessage id="pos.tables" />
        </h1>
        <div className="text-sm text-slate-500">
          {grouped.length} meja · {grouped.filter((t) => t.status === 'available').length} kosong
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        {grouped.map((table) => (
          <button
            key={table.id}
            onClick={() => handleSelect(table)}
            className={`rounded-xl border-2 p-4 text-left transition-transform hover:scale-105 ${STATUS_STYLE[table.status]}`}
          >
            <div className="text-xl font-bold">
              {intl.formatMessage({ id: 'pos.tableLabel' }, { label: table.label })}
            </div>
            <div className="mt-1 text-xs opacity-80">
              {STATUS_LABEL[table.status]} · {table.capacity} orang
            </div>
          </button>
        ))}

        {grouped.length === 0 ? (
          <div className="col-span-full rounded-xl border-2 border-dashed border-slate-300 p-12 text-center text-slate-500">
            Belum ada meja. Tambahkan dari halaman Pengaturan di admin app.
          </div>
        ) : null}
      </div>

      <footer className="mt-8 flex items-center justify-end gap-2">
        <Button variant="secondary" size="md" onClick={() => nav('/order')}>
          Order tanpa meja (take away)
        </Button>
      </footer>
    </div>
  );
}
