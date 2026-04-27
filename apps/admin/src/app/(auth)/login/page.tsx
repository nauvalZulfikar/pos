'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Login failed');
      }
      router.push('/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl"
      >
        <h1 className="mb-6 text-2xl font-semibold">Masuk</h1>
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <label className="mb-3 block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="mb-5 block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-emerald-600 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? 'Memuat...' : 'Masuk'}
        </button>
      </form>
    </main>
  );
}
