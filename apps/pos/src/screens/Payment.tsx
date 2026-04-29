import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Button, MoneyInput, formatCurrency } from '@desain/ui';
import { apiFetch, ApiError } from '../api/client.js';
import { useOrderDraftStore } from '../stores/order.js';

type Order = {
  id: string;
  outletOrderNumber: string;
  total: string;
  subtotal: string;
  status: string;
};

type Payment = {
  id: string;
  status: string;
  qrPayload: string | null;
  method: string;
  amount: string;
};

export function PaymentScreen() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const draft = useOrderDraftStore();
  const orderId = draft.activeOrderId;

  const orderQ = useQuery({
    queryKey: ['order', orderId],
    queryFn: () =>
      apiFetch<{ order: Order; items: unknown[] }>(`/v1/orders/${orderId}`),
    enabled: !!orderId,
  });

  const paymentsQ = useQuery({
    queryKey: ['payments', 'by-order', orderId],
    queryFn: () => apiFetch<{ items: Payment[] }>(`/v1/payments/by-order/${orderId}`),
    enabled: !!orderId,
  });

  if (!orderId) {
    return (
      <div className="grid h-full place-items-center">
        <div className="text-center">
          <p className="text-slate-500">Tidak ada order aktif.</p>
          <Button variant="primary" size="md" className="mt-3" onClick={() => nav('/tables')}>
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  if (orderQ.isLoading || !orderQ.data) {
    return <div className="grid h-full place-items-center text-slate-400">Memuat order...</div>;
  }

  const order = orderQ.data.order;
  const total = BigInt(order.total);
  const settledTotal = (paymentsQ.data?.items ?? [])
    .filter((p) => p.status === 'settled')
    .reduce((acc, p) => acc + BigInt(p.amount), BigInt(0));
  const remaining = total - settledTotal > BigInt(0) ? total - settledTotal : BigInt(0);

  if (order.status === 'paid') {
    return <PaidScreen orderId={order.id} orderNumber={order.outletOrderNumber} />;
  }

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['order', orderId] });
    qc.invalidateQueries({ queryKey: ['payments', 'by-order', orderId] });
  };

  return (
    <div className="grid h-full grid-cols-[1fr_400px] gap-0">
      <div className="bg-slate-50 p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold">Order #{order.outletOrderNumber}</h1>
          <p className="text-sm text-slate-500">
            Total: <span className="font-mono text-lg font-semibold">{formatCurrency(total)}</span>
          </p>
        </header>

        <VoucherPanel orderId={order.id} subtotal={total} onApplied={refresh} />

        {settledTotal > BigInt(0) ? (
          <section className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-semibold text-emerald-900">
              Sudah dibayar {formatCurrency(settledTotal)} dari {formatCurrency(total)}
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              Sisa: <strong>{formatCurrency(remaining)}</strong> · {paymentsQ.data?.items.length}{' '}
              pembayaran tercatat (split bill).
            </p>
          </section>
        ) : (
          <p className="text-sm text-slate-600">Pilih metode pembayaran di sebelah kanan →</p>
        )}
      </div>

      <aside className="overflow-y-auto border-l border-slate-200 bg-white p-4">
        <PaymentMethods
          orderId={order.id}
          amount={remaining > BigInt(0) ? remaining : total}
          onPaid={refresh}
        />
      </aside>
    </div>
  );
}

function VoucherPanel({
  orderId,
  subtotal,
  onApplied,
}: {
  orderId: string;
  subtotal: bigint;
  onApplied: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: async () => {
      const r = await apiFetch<{ code: string; discountSen: string }>(
        '/v1/vouchers/redeem',
        {
          method: 'POST',
          body: JSON.stringify({ code: code.trim().toUpperCase(), orderId, orderSubtotal: subtotal.toString() }),
        },
      );
      // Apply as discount on the order so total updates.
      await apiFetch(`/v1/orders/${orderId}/discount`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'amount',
          value: Number(BigInt(r.discountSen) / BigInt(100)),
          reason: `Voucher: ${r.code}`,
        }),
      });
      return r;
    },
    onSuccess: (r) => {
      setFeedback(`✓ Voucher ${r.code} dipakai — diskon ${formatCurrency(BigInt(r.discountSen))}`);
      setCode('');
      onApplied();
    },
    onError: (err) => {
      setFeedback(err instanceof ApiError ? err.message : 'Gagal validasi voucher');
    },
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
      >
        🎟️ Pakai Voucher
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Pakai Voucher</h3>
        <button
          onClick={() => {
            setOpen(false);
            setFeedback(null);
          }}
          className="text-xs text-slate-400 hover:underline"
        >
          Tutup
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Kode voucher (mis. HEMAT10)"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 font-mono uppercase"
        />
        <Button
          variant="primary"
          size="md"
          disabled={code.trim().length === 0 || m.isPending}
          onClick={() => {
            setFeedback(null);
            m.mutate();
          }}
        >
          {m.isPending ? '...' : 'Apply'}
        </Button>
      </div>
      {feedback ? (
        <p
          className={`mt-2 text-sm ${
            feedback.startsWith('✓') ? 'text-emerald-700' : 'text-red-600'
          }`}
        >
          {feedback}
        </p>
      ) : null}
    </section>
  );
}

function PaymentMethods({
  orderId,
  amount,
  onPaid,
}: {
  orderId: string;
  amount: bigint;
  onPaid: () => void;
}) {
  const [method, setMethod] = useState<'cash' | 'qris' | 'edc' | null>(null);
  const [splitMode, setSplitMode] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<bigint>(amount);

  // Reset charge amount when remaining changes (e.g. after a partial payment).
  useEffect(() => {
    setChargeAmount(amount);
  }, [amount]);

  const effective = splitMode ? chargeAmount : amount;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Metode Pembayaran</h2>
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={splitMode}
            onChange={(e) => setSplitMode(e.target.checked)}
          />
          Split bill
        </label>
      </div>
      {splitMode ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
          <p className="mb-2 font-medium text-amber-900">
            Split bill: cashier slice payment per metode.
          </p>
          <label className="block">
            <span className="mb-1 block text-xs">Jumlah untuk pembayaran berikut:</span>
            <MoneyInput value={chargeAmount} onChange={setChargeAmount} />
          </label>
          <p className="mt-1 text-xs text-amber-800">
            Sisa setelah ini: {formatCurrency(amount > chargeAmount ? amount - chargeAmount : BigInt(0))}
          </p>
        </div>
      ) : null}

      {method === null ? (
        <div className="grid grid-cols-1 gap-2">
          <MethodButton label="💵 Tunai" onClick={() => setMethod('cash')} />
          <MethodButton label="📱 QRIS / E-Wallet" onClick={() => setMethod('qris')} />
          <MethodButton label="💳 Kartu (EDC)" onClick={() => setMethod('edc')} />
        </div>
      ) : null}

      {method === 'cash' ? (
        <CashPayment
          orderId={orderId}
          amount={effective}
          onCancel={() => setMethod(null)}
          onPaid={() => {
            setMethod(null);
            onPaid();
          }}
        />
      ) : null}
      {method === 'qris' ? (
        <QrisPayment
          orderId={orderId}
          amount={effective}
          onCancel={() => setMethod(null)}
          onPaid={() => {
            setMethod(null);
            onPaid();
          }}
        />
      ) : null}
      {method === 'edc' ? (
        <EdcPayment
          orderId={orderId}
          amount={effective}
          onCancel={() => setMethod(null)}
          onPaid={() => {
            setMethod(null);
            onPaid();
          }}
        />
      ) : null}
    </div>
  );
}

function MethodButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-4 text-left text-lg font-medium hover:border-emerald-500 hover:bg-emerald-50"
    >
      {label}
    </button>
  );
}

function CashPayment({
  orderId,
  amount,
  onCancel,
  onPaid,
}: {
  orderId: string;
  amount: bigint;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const [tendered, setTendered] = useState<bigint>(amount);
  const change = tendered > amount ? tendered - amount : BigInt(0);

  const m = useMutation({
    mutationFn: () =>
      apiFetch('/v1/payments/cash', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          amount: amount.toString(),
          tendered: tendered.toString(),
        }),
      }),
    onSuccess: onPaid,
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Tunai</h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:underline">
          Ganti
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm">Diterima dari customer:</span>
        <MoneyInput value={tendered} onChange={setTendered} autoFocus />
      </label>
      <div className="rounded bg-slate-50 p-3 text-sm">
        Total: <strong>{formatCurrency(amount)}</strong>
        <br />
        Diterima: <strong>{formatCurrency(tendered)}</strong>
        <br />
        Kembalian:{' '}
        <strong className={change > BigInt(0) ? 'text-emerald-700' : ''}>
          {formatCurrency(change)}
        </strong>
      </div>
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={tendered < amount || m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? 'Memproses...' : 'Konfirmasi Bayar'}
      </Button>
      {m.error ? (
        <p className="text-xs text-red-600">
          {m.error instanceof ApiError ? m.error.message : 'Gagal'}
        </p>
      ) : null}
    </div>
  );
}

function QrisPayment({
  orderId,
  amount,
  onCancel,
  onPaid,
}: {
  orderId: string;
  amount: bigint;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [mock, setMock] = useState(false);

  const intent = useMutation({
    mutationFn: () =>
      apiFetch<{ paymentId: string; qrPayload: string; mock: boolean }>(
        '/v1/payments/qris/intent',
        {
          method: 'POST',
          body: JSON.stringify({ orderId, amount: amount.toString(), method: 'qris' }),
        },
      ),
    onSuccess: (r) => {
      setPaymentId(r.paymentId);
      setQrPayload(r.qrPayload);
      setMock(r.mock);
    },
  });

  // Poll payment status every 2s
  const { data: paymentStatus } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => apiFetch<{ payment: Payment }>(`/v1/payments/${paymentId}`),
    enabled: !!paymentId,
    refetchInterval: 2000,
  });

  useEffect(() => {
    if (paymentStatus?.payment.status === 'settled') {
      onPaid();
    }
  }, [paymentStatus, onPaid]);

  const mockSettle = useMutation({
    mutationFn: () =>
      apiFetch('/v1/payments/qris/mock-settle', {
        method: 'POST',
        body: JSON.stringify({ paymentId }),
      }),
    onSuccess: onPaid,
  });

  if (!paymentId) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">QRIS</h3>
          <button onClick={onCancel} className="text-xs text-slate-400 hover:underline">
            Ganti
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Akan generate QR untuk{' '}
          <strong>{formatCurrency(amount)}</strong>. Customer scan QR pakai HP.
        </p>
        <Button
          variant="primary"
          size="xl"
          className="w-full"
          disabled={intent.isPending}
          onClick={() => intent.mutate()}
        >
          {intent.isPending ? 'Generate...' : 'Generate QR'}
        </Button>
        {intent.error ? (
          <p className="text-xs text-red-600">
            {intent.error instanceof ApiError ? intent.error.message : 'Gagal'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Scan QR untuk membayar</h3>
      <div className="rounded-lg bg-slate-50 p-6 text-center">
        <pre className="mx-auto max-w-[200px] break-all text-xs text-slate-700">
          {qrPayload ?? '...'}
        </pre>
        {mock ? (
          <p className="mt-2 text-xs text-amber-700">⚠️ Mock mode (Midtrans key belum di-set)</p>
        ) : null}
      </div>
      <p className="text-center text-sm text-slate-500">
        {paymentStatus?.payment.status === 'pending'
          ? 'Menunggu pembayaran...'
          : paymentStatus?.payment.status}
      </p>
      {mock ? (
        <Button
          variant="secondary"
          size="md"
          className="w-full"
          onClick={() => mockSettle.mutate()}
        >
          [DEV] Simulasi customer bayar
        </Button>
      ) : null}
      <button onClick={onCancel} className="block w-full text-sm text-slate-500 hover:underline">
        Batal & ganti metode
      </button>
    </div>
  );
}

function EdcPayment({
  orderId,
  amount,
  onCancel,
  onPaid,
}: {
  orderId: string;
  amount: bigint;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const [last4, setLast4] = useState('');
  const m = useMutation({
    mutationFn: () =>
      apiFetch('/v1/payments/card-edc', {
        method: 'POST',
        body: JSON.stringify({
          orderId,
          amount: amount.toString(),
          cardLast4: last4 || undefined,
        }),
      }),
    onSuccess: onPaid,
  });

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Kartu (EDC)</h3>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:underline">
          Ganti
        </button>
      </div>
      <p className="text-sm text-slate-600">
        Charge melalui mesin EDC bank. Setelah berhasil, masukkan 4 digit terakhir kartu (opsional).
      </p>
      <input
        value={last4}
        onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder="4 digit terakhir kartu"
        className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono"
        inputMode="numeric"
        maxLength={4}
      />
      <Button
        variant="primary"
        size="xl"
        className="w-full"
        disabled={m.isPending}
        onClick={() => m.mutate()}
      >
        {m.isPending ? 'Memproses...' : `Konfirmasi ${formatCurrency(amount)}`}
      </Button>
      {m.error ? (
        <p className="text-xs text-red-600">
          {m.error instanceof ApiError ? m.error.message : 'Gagal'}
        </p>
      ) : null}
    </div>
  );
}

function PaidScreen({ orderId, orderNumber }: { orderId: string; orderNumber: string }) {
  const nav = useNavigate();
  const draft = useOrderDraftStore();

  const printReceipt = async () => {
    try {
      const r = await fetch(`/api/v1/orders/${orderId}/text`, { credentials: 'include' });
      const text = await r.text();
      // Open new window with raw text — user can Ctrl+P from there
      const w = window.open('', '_blank', 'width=400,height=600');
      if (w) {
        w.document.write(
          `<html><head><title>Struk #${orderNumber}</title></head><body style="font-family:monospace;font-size:12px;white-space:pre-wrap;padding:20px"><pre>${text}</pre><button onclick="window.print()" style="margin-top:20px;padding:8px 16px">Print</button></body></html>`,
        );
      }
    } catch {
      alert('Gagal load struk');
    }
  };

  const finish = () => {
    draft.clear();
    nav('/tables');
  };

  return (
    <div className="grid h-full place-items-center bg-emerald-50">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-600 text-3xl text-white mx-auto">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">Pembayaran Berhasil</h1>
        <p className="mt-2 text-slate-500">Order #{orderNumber}</p>
        <div className="mt-6 grid grid-cols-1 gap-2">
          <Button variant="secondary" size="lg" onClick={printReceipt}>
            🖨️ Cetak Struk
          </Button>
          <Button variant="primary" size="lg" onClick={finish}>
            Order Baru →
          </Button>
        </div>
      </div>
    </div>
  );
}
