/**
 * Sentry init — env-gated. No-op without SENTRY_DSN or @sentry/node installed.
 */

import { logger } from './logger.js';

let sentryInitialized = false;

type SentryShape = {
  init: (cfg: { dsn: string; environment: string; tracesSampleRate: number; release: string }) => void;
  captureException: (err: unknown) => void;
};

let sentryRef: SentryShape | null = null;

/**
 * Try to import @sentry/node at runtime without a static dependency.
 * Falls back gracefully when the package is absent from node_modules.
 */
async function tryLoadSentry(): Promise<SentryShape | null> {
  try {
    // Wrap in Function constructor so tsc/webpack don't try to statically resolve.
    const dynamicImport = new Function('m', 'return import(m)') as (m: string) => Promise<unknown>;
    const mod = (await dynamicImport('@sentry/node')) as SentryShape;
    return mod && typeof mod.init === 'function' ? mod : null;
  } catch {
    return null;
  }
}

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.debug('[sentry] DSN not set, skipping init');
    return;
  }
  const mod = await tryLoadSentry();
  if (!mod) {
    logger.warn('[sentry] @sentry/node not installed; skipping');
    return;
  }
  try {
    mod.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      release: process.env.GIT_SHA ?? 'dev',
    });
    sentryRef = mod;
    sentryInitialized = true;
    logger.info('[sentry] initialized');
  } catch (err) {
    logger.warn({ err }, '[sentry] init failed');
  }
}

export function captureException(err: unknown): void {
  if (!sentryInitialized || !sentryRef) return;
  try {
    sentryRef.captureException(err);
  } catch {
    /* swallow — error reporting must never throw */
  }
}
