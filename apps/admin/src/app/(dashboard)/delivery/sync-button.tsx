'use client';

import { useState } from 'react';
import { triggerMenuSync } from './actions';

export function SyncButton() {
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const onClick = async () => {
    setState('busy');
    try {
      await triggerMenuSync();
      setState('ok');
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setState('err');
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={state === 'busy'}
      className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      {state === 'busy'
        ? 'Mengirim…'
        : state === 'ok'
        ? '✓ Antrian dikirim'
        : state === 'err'
        ? '✗ Gagal'
        : '🔄 Menu Sync 1 Klik'}
    </button>
  );
}
