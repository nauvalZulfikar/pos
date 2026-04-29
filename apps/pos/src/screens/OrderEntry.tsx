import { useMemo, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, formatCurrency } from '@desain/ui';
import { computeOrderTotals } from '@desain/domain';
import { uuidv7 } from 'uuidv7';
import { apiFetch, ApiError } from '../api/client.js';
import { useOrderDraftStore } from '../stores/order.js';
import { useSessionStore } from '../stores/session.js';

type MenuItem = {
  id: string;
  name: string;
  basePrice: string;
  categoryId: string;
  ppnBpsOverride: number | null;
  imageUrl: string | null;
};

type Category = { id: string; name: string };

export function OrderEntryScreen() {
  const intl = useIntl();
  const nav = useNavigate();
  const qc = useQueryClient();
  const tenantId = useSessionStore((s) => s.tenantId);
  const outletId = useSessionStore((s) => s.outletId);
  const draft = useOrderDraftStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showDiscount, setShowDiscount] = useState(false);
  const [voidLine, setVoidLine] = useState<string | null>(null);
  const [showHolds, setShowHolds] = useState(false);

  const categoriesQ = useQuery({
    queryKey: ['menu', 'categories', tenantId],
    queryFn: () => apiFetch<{ items: Category[] }>('/v1/menu/categories'),
    enabled: !!tenantId,
  });

  const itemsQ = useQuery({
    queryKey: ['menu', 'items', tenantId],
    queryFn: () => apiFetch<{ items: MenuItem[] }>('/v1/menu/items'),
    enabled: !!tenantId,
  });

  const totals = useMemo(() => {
    return computeOrderTotals({
      items: draft.lines.map((l) => ({
        lineSubtotal: l.unitPrice * BigInt(l.quantity),
        ppnBpsSnapshot: 1100,
        status: 'queued' as const,
      })),
      orderDiscount: draft.discountSen ?? BigInt(0),
      serviceChargeBps: 500,
      tenantIsPkp: true,
    });
  }, [draft.lines, draft.discountSen]);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const it of itemsQ.data?.items ?? []) {
      const arr = map.get(it.categoryId) ?? [];
      arr.push(it);
      map.set(it.categoryId, arr);
    }
    return map;
  }, [itemsQ.data]);

  const filtered = useMemo(() => {
    if (!activeCategory) return itemsQ.data?.items ?? [];
    return itemsByCategory.get(activeCategory) ?? [];
  }, [activeCategory, itemsByCategory, itemsQ.data]);

  const addItem = (item: MenuItem) => {
    draft.addLine({
      id: uuidv7(),
      menuItemId: item.id,
      itemNameSnapshot: item.name,
      unitPrice: BigInt(item.basePrice),
      quantity: 1,
      modifiersTotal: BigInt(0),
      notes: null,
    });
  };

  const submitOrder = useMutation({
    mutationFn: async () => {
      if (!outletId) throw new Error('outlet not paired');
      const r = await apiFetch<{ order: { id: string; outletOrderNumber: string } }>(
        '/v1/orders',
        {
          method: 'POST',
          body: JSON.stringify({
            outletId,
            shiftId: draft.shiftId,
            tableId: draft.tableId,
            source: draft.tableId ? 'pos_dine_in' : 'pos_take_away',
            pricingProfile: draft.pricingProfile,
            customerName: draft.customerName,
            guestCount: draft.guestCount,
            items: draft.lines.map((l) => ({
              menuItemId: l.menuItemId,
              quantity: l.quantity,
              modifiers: [],
              notes: l.notes,
            })),
            notes: draft.notes,
          }),
        },
      );
      // Apply order-level discount if present
      if (draft.discountSen && draft.discountSen > BigInt(0) && draft.discountReason) {
        await apiFetch(`/v1/orders/${r.order.id}/discount`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'amount',
            value: Number(draft.discountSen / BigInt(100)),
            reason: draft.discountReason,
          }),
        });
      }
      return r;
    },
    onSuccess: ({ order }) => {
      draft.setActiveOrderId(order.id);
      nav('/pay');
    },
  });

  const sendToKitchen = useMutation({
    mutationFn: async () => {
      if (!draft.lines.length) return;
      const r = await submitOrder.mutateAsync();
      await apiFetch(`/v1/orders/${r.order.id}/send-to-kitchen`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      draft.clear();
      nav('/tables');
    },
  });

  return (
    <div className="grid h-full grid-cols-[1fr_380px] gap-0">
      <div className="flex flex-col overflow-hidden">
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white p-3">
          <Button
            variant={activeCategory === null ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setActiveCategory(null)}
          >
            Semua
          </Button>
          {categoriesQ.data?.items.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.name}
            </Button>
          )) ?? null}
        </div>
        <div className="flex-1 overflow-auto p-4">
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => addItem(item)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-emerald-500 hover:bg-emerald-50"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="mb-2 h-24 w-full rounded object-cover"
                  />
                ) : (
                  <div className="mb-2 grid h-24 w-full place-items-center rounded bg-slate-100 text-slate-400">
                    🍽️
                  </div>
                )}
                <div className="text-base font-medium">{item.name}</div>
                <div className="text-sm text-slate-600">
                  {formatCurrency(BigInt(item.basePrice))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="flex flex-col border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm uppercase tracking-wider text-slate-500">
              <FormattedMessage id="pos.newOrder" />
            </span>
            {draft.tableId ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
                Meja
              </span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                Take away
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          {draft.lines.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">
              {intl.formatMessage({ id: 'pos.noOpenOrders' })}
            </div>
          ) : (
            <ul>
              {draft.lines.map((line) => (
                <li key={line.id} className="border-b border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{line.itemNameSnapshot}</div>
                      <div className="text-sm text-slate-500">
                        {line.quantity}× {formatCurrency(line.unitPrice)}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      {formatCurrency(line.unitPrice * BigInt(line.quantity))}
                    </div>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        draft.updateLine(line.id, {
                          quantity: Math.max(1, line.quantity - 1),
                        })
                      }
                    >
                      −
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => draft.updateLine(line.id, { quantity: line.quantity + 1 })}
                    >
                      +
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setVoidLine(line.id)}>
                      Void
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-slate-200 p-3">
          <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
          {totals.discountTotal > BigInt(0) ? (
            <Row
              label="Diskon"
              value={`−${formatCurrency(totals.discountTotal)}`}
              accent="text-emerald-700"
            />
          ) : null}
          {totals.serviceCharge > BigInt(0) ? (
            <Row label="Service" value={formatCurrency(totals.serviceCharge)} />
          ) : null}
          {totals.ppnTotal > BigInt(0) ? (
            <Row label="PPN" value={formatCurrency(totals.ppnTotal)} />
          ) : null}
          <Row label="TOTAL" value={formatCurrency(totals.total)} bold />

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowDiscount(true)}>
              + Diskon
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => sendToKitchen.mutate()}
              disabled={draft.lines.length === 0 || sendToKitchen.isPending}
            >
              Kirim Dapur
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={draft.lines.length === 0}
              onClick={() => {
                const label = window.prompt('Nama untuk hold (opsional):') ?? '';
                draft.hold(label);
              }}
            >
              ⏸ Hold
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHolds(true)}
            >
              📋 Holds ({draft.holds.length})
            </Button>
          </div>

          <Button
            variant="primary"
            size="xl"
            className="mt-2 w-full"
            disabled={draft.lines.length === 0 || submitOrder.isPending}
            onClick={() => submitOrder.mutate()}
          >
            {submitOrder.isPending ? 'Menyimpan...' : 'Bayar →'}
          </Button>

          {submitOrder.error ? (
            <p className="mt-2 text-xs text-red-600">
              {submitOrder.error instanceof ApiError
                ? submitOrder.error.message
                : 'Gagal menyimpan order'}
            </p>
          ) : null}
        </div>
      </aside>

      {showDiscount ? <DiscountModal onClose={() => setShowDiscount(false)} /> : null}
      {voidLine ? <VoidModal lineId={voidLine} onClose={() => setVoidLine(null)} /> : null}
      {showHolds ? <HoldsModal onClose={() => setShowHolds(false)} /> : null}
    </div>
  );
}

function HoldsModal({ onClose }: { onClose: () => void }) {
  const draft = useOrderDraftStore();
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Order yang di-hold</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Resume untuk lanjutkan, atau hapus jika sudah tidak relevan.
        </p>
        {draft.holds.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">
            Belum ada order yang di-hold. Tekan tombol Hold di kanan bawah.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-auto">
            {draft.holds.map((h) => {
              const total = h.lines.reduce(
                (acc, l) => acc + BigInt(l.unitPrice) * BigInt(l.quantity),
                BigInt(0),
              );
              return (
                <li
                  key={h.id}
                  className="flex items-start justify-between rounded-md border border-slate-200 p-3"
                >
                  <div>
                    <p className="font-medium">{h.label}</p>
                    <p className="text-xs text-slate-500">
                      {h.lines.length} item · {formatCurrency(total)} ·{' '}
                      {new Date(h.heldAt).toLocaleTimeString('id-ID')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        if (draft.lines.length > 0) {
                          if (!confirm('Cart aktif masih ada item — di-hold dulu?')) return;
                          draft.hold('Auto-hold');
                        }
                        draft.resume(h.id);
                        onClose();
                      }}
                    >
                      Resume
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Hapus hold ini?')) draft.removeHold(h.id);
                      }}
                    >
                      Hapus
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="secondary" size="md" className="mt-4 w-full" onClick={onClose}>
          Tutup
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
}: {
  label: string;
  value: string;
  bold?: boolean;
  accent?: string;
}) {
  return (
    <div
      className={`flex justify-between py-1 ${bold ? 'text-lg font-semibold' : 'text-sm'} ${accent ?? ''}`}
    >
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function DiscountModal({ onClose }: { onClose: () => void }) {
  const draft = useOrderDraftStore();
  const [type, setType] = useState<'percent' | 'amount'>('percent');
  const [value, setValue] = useState<number>(0);
  const [reason, setReason] = useState('');

  const apply = () => {
    if (reason.length < 3) {
      alert('Alasan diskon minimal 3 karakter');
      return;
    }
    const subtotal = draft.lines.reduce(
      (acc, l) => acc + l.unitPrice * BigInt(l.quantity),
      BigInt(0),
    );
    let sen: bigint;
    if (type === 'percent') {
      sen = (subtotal * BigInt(Math.round(value * 100))) / BigInt(10_000);
    } else {
      sen = BigInt(Math.round(value * 100));
    }
    if (sen > subtotal) sen = subtotal;
    draft.setDiscount(sen, reason);
    onClose();
  };

  return (
    <Modal title="Apply Diskon" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={type === 'percent' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setType('percent')}
          >
            Persen %
          </Button>
          <Button
            variant={type === 'amount' ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setType('amount')}
          >
            Nominal Rp
          </Button>
        </div>
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || 0)}
          placeholder={type === 'percent' ? '10 (untuk 10%)' : '5000'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-right font-mono text-lg"
          autoFocus
        />
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan (wajib, min 3 karakter)"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          rows={2}
        />
        <Button variant="primary" size="lg" className="w-full" onClick={apply}>
          Apply
        </Button>
      </div>
    </Modal>
  );
}

function VoidModal({ lineId, onClose }: { lineId: string; onClose: () => void }) {
  const draft = useOrderDraftStore();
  const [reason, setReason] = useState('');

  const confirm = () => {
    if (reason.length < 3) {
      alert('Alasan void minimal 3 karakter');
      return;
    }
    draft.removeLine(lineId);
    onClose();
  };

  return (
    <Modal title="Void item?" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Item akan dihapus dari order ini. Aksi tercatat di audit log saat order disimpan.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Alasan void (min 3 karakter)"
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          rows={3}
          autoFocus
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="md" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button variant="danger" size="md" className="flex-1" onClick={confirm}>
            Void
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-2xl leading-none text-slate-400">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
