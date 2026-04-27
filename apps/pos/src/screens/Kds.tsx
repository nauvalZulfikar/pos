import { FormattedMessage } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client.js';

type Order = {
  id: string;
  outletOrderNumber: string;
  status: string;
  createdAt: string;
  customerName: string | null;
  items?: Array<{ id: string; itemNameSnapshot: string; quantity: number; status: string; notes: string | null }>;
};

export function KdsScreen() {
  const ordersQ = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => apiFetch<{ items: Order[] }>('/v1/orders?status=sent_to_kitchen'),
    refetchInterval: 4000,
  });

  const orders = ordersQ.data?.items ?? [];

  return (
    <div className="grid h-full grid-cols-1 gap-3 overflow-auto bg-slate-900 p-4 md:grid-cols-2 xl:grid-cols-3">
      {orders.length === 0 ? (
        <div className="col-span-full flex h-full items-center justify-center text-2xl text-slate-400">
          <FormattedMessage id="kds.noOrders" />
        </div>
      ) : null}
      {orders.map((order) => (
        <article key={order.id} className="rounded-xl bg-white p-4 shadow-lg">
          <header className="mb-3 flex items-center justify-between">
            <span className="rounded-md bg-emerald-100 px-2 py-1 text-sm font-bold text-emerald-700">
              #{order.outletOrderNumber}
            </span>
            <time className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString('id-ID')}</time>
          </header>
          <ul className="space-y-1">
            {order.items?.map((it) => (
              <li key={it.id} className="flex justify-between text-base">
                <span>{it.quantity}× {it.itemNameSnapshot}</span>
                <span className="text-xs uppercase text-slate-500">{it.status}</span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}
