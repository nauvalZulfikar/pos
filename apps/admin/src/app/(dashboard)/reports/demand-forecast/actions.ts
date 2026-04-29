'use server';

import { apiFetch } from '@/lib/api';

export async function triggerForecastRefresh(): Promise<void> {
  await apiFetch('/v1/ai/demand-forecasts/refresh', { method: 'POST' });
}
