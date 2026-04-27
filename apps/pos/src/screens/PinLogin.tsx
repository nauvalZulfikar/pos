import { useEffect, useState } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Numpad } from '@desain/ui';
import { apiFetch, ApiError } from '../api/client.js';
import { useSessionStore } from '../stores/session.js';

type LoginResponse = {
  session: { id: string; expiresAt: string };
  activeTenantId: string;
  outletId: string;
  role: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PinLoginScreen() {
  const intl = useIntl();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const setSession = useSessionStore((s) => s.setSession);
  const sessionOutletId = useSessionStore((s) => s.outletId);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [manualOutletId, setManualOutletId] = useState('');

  // Pair the terminal to an outlet via ?outlet=<uuid> on first visit.
  useEffect(() => {
    const fromUrl = params.get('outlet');
    if (fromUrl && UUID_RE.test(fromUrl) && !sessionOutletId) {
      setSession({ outletId: fromUrl });
    }
  }, [params, sessionOutletId, setSession]);

  const outletId = sessionOutletId;

  const submit = async () => {
    if (pin.length !== 4 || !outletId) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await apiFetch<LoginResponse>('/v1/auth/pin-login', {
        method: 'POST',
        body: JSON.stringify({ pin, outletId }),
      });
      setSession({
        tenantId: r.activeTenantId,
        outletId: r.outletId,
        role: r.role,
      });
      nav('/tables');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          intl.formatMessage({ id: `errors.${err.code}` }, { detail: err.message }) ||
            err.message,
        );
      } else {
        setError('Network error');
      }
      setPin('');
    } finally {
      setSubmitting(false);
    }
  };

  const pairOutlet = () => {
    if (UUID_RE.test(manualOutletId)) {
      setSession({ outletId: manualOutletId });
    } else {
      setError('UUID outlet tidak valid');
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <h1 className="mb-2 text-2xl font-semibold">DESAIN POS</h1>

        {!outletId ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Pasangkan terminal ke cabang. Tempel UUID outlet di bawah, atau buka URL dengan
              <code className="ml-1">?outlet=…</code>
            </p>
            <input
              value={manualOutletId}
              onChange={(e) => setManualOutletId(e.target.value)}
              placeholder="00000000-0000-7000-8000-000000000002"
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            {error ? (
              <div className="mb-3 rounded-md bg-red-50 p-2 text-xs text-red-700">{error}</div>
            ) : null}
            <Button variant="primary" size="lg" className="w-full" onClick={pairOutlet}>
              Pasang ke cabang
            </Button>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              <FormattedMessage id="auth.pinPrompt" />
            </p>

            <div className="mb-6 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-12 w-12 rounded-md border text-center text-3xl leading-[3rem] ${pin[i] ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300'}`}
                >
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            {error ? (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            <Numpad value={pin} onChange={setPin} maxLength={4} onSubmit={submit} />

            <Button
              variant="primary"
              size="lg"
              className="mt-4 w-full"
              disabled={pin.length !== 4 || submitting}
              onClick={submit}
            >
              <FormattedMessage id="auth.login" />
            </Button>

            <button
              type="button"
              onClick={() => useSessionStore.getState().setSession({ outletId: null })}
              className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-600"
            >
              Ganti cabang
            </button>
          </>
        )}
      </div>
    </div>
  );
}
