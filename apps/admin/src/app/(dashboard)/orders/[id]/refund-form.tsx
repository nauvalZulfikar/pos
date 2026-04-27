'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { refundPayment } from './actions';

export function RefundForm({
  paymentId,
  amount,
  method,
}: {
  paymentId: string;
  amount: string;
  method: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountRupiah = (BigInt(amount) / BigInt(100)).toString();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await refundPayment(paymentId, fd);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal refund');
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        Refund {method === 'qris' ? '(via Midtrans)' : ''}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded border border-red-200 bg-red-50 p-3">
      <div>
        <label className="block text-xs font-medium text-slate-700">Jumlah refund (Rp)</label>
        <input
          name="amountRupiah"
          type="number"
          min="1"
          max={amountRupiah}
          defaultValue={amountRupiah}
          required
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-right font-mono text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700">Alasan</label>
        <input
          name="reason"
          required
          minLength={3}
          maxLength={500}
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="contoh: customer cancel, item habis"
        />
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex-1 rounded border border-slate-300 px-3 py-1 text-xs"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Memproses...' : 'Konfirmasi Refund'}
        </button>
      </div>
    </form>
  );
}
