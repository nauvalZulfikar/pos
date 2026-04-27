/**
 * Background sync runner. Coordinates network detection + drain.
 *
 * Designed to be called from a Web Worker, but works on the main thread for tests.
 */

import { drainAll } from './outbox.js';
import type { SendBatch } from './outbox.js';

export type RunnerOpts = {
  send: SendBatch;
  /** Idle interval between drains when online. Default 4s. */
  idleMs?: number;
  /** Backoff cap when offline / failures. Default 60s. */
  maxBackoffMs?: number;
  /** Online detector. Default `navigator.onLine`. */
  isOnline?: () => boolean;
  /** Logger. */
  onError?: (err: unknown) => void;
};

export type RunnerHandle = {
  stop: () => void;
  triggerNow: () => void;
};

export function startRunner(opts: RunnerOpts): RunnerHandle {
  let stopped = false;
  let backoff = opts.idleMs ?? 4000;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const idle = opts.idleMs ?? 4000;
  const max = opts.maxBackoffMs ?? 60_000;
  const online = opts.isOnline ?? (() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  const tick = async () => {
    if (stopped) return;
    if (!online()) {
      backoff = Math.min(max, Math.max(idle, backoff * 2));
      schedule();
      return;
    }
    try {
      const r = await drainAll(opts.send);
      if (r.applied + r.duplicates > 0) backoff = idle;
      else backoff = Math.min(max, Math.max(idle, backoff * 1.5));
    } catch (err) {
      opts.onError?.(err);
      backoff = Math.min(max, Math.max(idle, backoff * 2));
    }
    schedule();
  };

  const schedule = () => {
    timer = setTimeout(() => {
      void tick();
    }, backoff);
  };

  schedule();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
    triggerNow: () => {
      if (timer) clearTimeout(timer);
      void tick();
    },
  };
}
