import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { IntlProvider } from 'react-intl';
import { messages, DEFAULT_LOCALE } from '@desain/ui';
import { App } from './App.js';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    mutations: { retry: 0 },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');

createRoot(root).render(
  <StrictMode>
    <IntlProvider locale={DEFAULT_LOCALE} messages={flatten(messages[DEFAULT_LOCALE])}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </IntlProvider>
  </StrictMode>,
);

function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else if (typeof v === 'object' && v !== null) Object.assign(out, flatten(v as Record<string, unknown>, key));
  }
  return out;
}
