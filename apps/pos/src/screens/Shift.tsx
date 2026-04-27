import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { Button, MoneyInput, formatCurrency } from '@desain/ui';
import { useSessionStore } from '../stores/session.js';
import { useOrderDraftStore } from '../stores/order.js';

type ActiveShift = {
  id: string;
  startingCash: string | bigint;
  openedAt: string;
  outletId: string;
} | null;

type CloseSummary = {
  startingCash: string;
  cashIn: string;
  expected: string;
  counted: string;
  variance: string;
  totalSales: string;
  totalOrders: number;
};

export function ShiftScreen() {
  const intl = useIntl();
  const outletId = useSessionStore((s) => s.outletId);
  const setShiftId = useOrderDraftStore((s) => s.setShift);

  const [active, setActive] = useState<ActiveShift>(null);
  const [loading, setLoading] = useState(true);
  const [startingCash, setStartingCash] = useState<bigint>(BigInt(0));
  const [countedCash, setCountedCash] = useState<bigint>(BigInt(0));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CloseSummary | null>(null);

  useEffect(() => {
    void loadActive();
  }, []);

  const loadActive = async () => {
    if (!outletId) {
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(`/api/v1/shifts/active?outletId=${outletId}`, {
        credentials: 'include',
      });
      if (r.ok) {
        const j = (await r.json()) as { shift: ActiveShift };
        setActive(j.shift);
        if (j.shift) setShiftId(j.shift.id);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const open = async () => {
    if (!outletId) {
      setError('Outlet belum dipilih');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/v1/shifts/open', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outletId, startingCash: startingCash.toString() }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(j?.detail ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as { shift: ActiveShift };
      setActive(j.shift);
      if (j.shift) setShiftId(j.shift.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!active) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/shifts/${active.id}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedCash: countedCash.toString(),
          notes: notes.trim() || null,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(j?.detail ?? `HTTP ${r.status}`);
      }
      const j = (await r.json()) as { summary: CloseSummary };
      setSummary(j.summary);
      setActive(null);
      setShiftId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Memuat shift…</div>;
  }

  if (summary) {
    const variance = BigInt(summary.variance);
    return (
      <div className="mx-auto flex h-full max-w-md flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">Ringkasan Shift</h1>
        <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
          <Row label="Modal awal" value={formatCurrency(BigInt(summary.startingCash))} />
          <Row label="Penjualan tunai" value={formatCurrency(BigInt(summary.cashIn))} />
          <Row label="Total penjualan" value={formatCurrency(BigInt(summary.totalSales))} />
          <Row label="Jumlah order" value={summary.totalOrders.toString()} />
          <hr className="my-2 border-slate-200" />
          <Row label="Kas seharusnya" value={formatCurrency(BigInt(summary.expected))} />
          <Row label="Kas dihitung" value={formatCurrency(BigInt(summary.counted))} />
          <Row
            label="Selisih"
            value={formatCurrency(variance)}
            highlight={variance === BigInt(0) ? 'ok' : 'bad'}
          />
        </div>
        <Button variant="primary" size="xl" onClick={() => setSummary(null)}>
          Selesai
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">
        <FormattedMessage id={active ? 'shift.close' : 'shift.open'} />
      </h1>

      {error ? (
        <div className="w-full rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!active ? (
        <>
          <label className="w-full text-sm font-medium text-slate-700">
            <FormattedMessage id="shift.startingCash" />
          </label>
          <MoneyInput
            value={startingCash}
            onChange={setStartingCash}
            ariaLabel={intl.formatMessage({ id: 'shift.startingCash' })}
          />
          <Button
            variant="primary"
            size="xl"
            className="w-full"
            onClick={open}
            disabled={busy || !outletId}
          >
            <FormattedMessage id="shift.open" />
          </Button>
        </>
      ) : (
        <>
          <div className="w-full rounded-lg bg-slate-50 p-4 text-sm">
            <p>
              <FormattedMessage id="shift.startingCash" />:{' '}
              <b className="font-mono">{formatCurrency(BigInt(active.startingCash))}</b>
            </p>
            <p className="text-slate-500">
              {new Date(active.openedAt).toLocaleString('id-ID')}
            </p>
          </div>
          <label className="w-full text-sm font-medium text-slate-700">Hitung kas akhir</label>
          <MoneyInput
            value={countedCash}
            onChange={setCountedCash}
            ariaLabel="Counted cash"
          />
          <label className="w-full text-sm font-medium text-slate-700">Catatan (opsional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            placeholder="Setoran ke brankas, dll."
          />
          <Button variant="danger" size="xl" className="w-full" onClick={close} disabled={busy}>
            <FormattedMessage id="shift.close" />
          </Button>
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'ok' | 'bad';
}) {
  const cls = highlight === 'ok' ? 'text-emerald-600' : highlight === 'bad' ? 'text-red-600' : '';
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <b className={`font-mono ${cls}`}>{value}</b>
    </div>
  );
}
