'use client';

import { useState } from 'react';
import { triggerMenuScoreRefresh } from './actions';

export function RefreshButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const onClick = async () => {
    setState('busy');
    try {
      await triggerMenuScoreRefresh();
      setState('ok');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      setState('err');
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={state === 'busy'}
      className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {state === 'busy'
        ? 'Memproses...'
        : state === 'ok'
        ? '✓ Antrian dikirim'
        : state === 'err'
        ? '✗ Gagal'
        : '🔄 Refresh sekarang'}
    </button>
  );
}
