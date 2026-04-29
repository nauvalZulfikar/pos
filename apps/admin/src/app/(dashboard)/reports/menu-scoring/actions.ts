'use server';

import { apiFetch } from '@/lib/api';

export async function triggerMenuScoreRefresh(): Promise<void> {
  await apiFetch('/v1/ai/menu-scores/refresh', { method: 'POST' });
}
