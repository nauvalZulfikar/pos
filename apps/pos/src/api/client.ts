/**
 * Tiny fetch wrapper. Sends cookies, parses RFC 7807 errors.
 */

const API_BASE = '/api';

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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
    ...init,
  });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
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
