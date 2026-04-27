/**
 * Server-side API client for admin app. Forwards the session cookie from the
 * incoming request so RLS + entitlement checks fire identically to the POS path.
 */

import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:3000';
const SESSION_COOKIE = 'desain_sid';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type FetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** When true, do not throw on non-2xx; return the problem details. */
  passthroughErrors?: boolean;
};

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(SESSION_COOKIE)?.value;
  const headers = new Headers(opts.headers);
  if (sid) headers.set('cookie', `${SESSION_COOKIE}=${sid}`);
  if (opts.body !== undefined) headers.set('content-type', 'application/json');
  headers.set('accept', 'application/json');

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });

  const text = await res.text();
  const body = text ? safeJson(text) : null;

  if (!res.ok && !opts.passthroughErrors) {
    const problem = body as { code?: string; detail?: string } | null;
    throw new ApiError(
      res.status,
      problem?.code ?? `HTTP_${res.status}`,
      problem?.detail ?? res.statusText,
      problem ?? {},
    );
  }
  return body as T;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
