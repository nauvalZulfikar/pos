'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function createDeliveryLink(formData: FormData): Promise<void> {
  const outletId = String(formData.get('outletId') ?? '');
  const platform = String(formData.get('platform') ?? '');
  const externalMerchantId = String(formData.get('externalMerchantId') ?? '');
  if (!outletId || !platform || !externalMerchantId) {
    throw new Error('Form belum lengkap.');
  }
  await apiFetch('/v1/delivery/links', {
    method: 'POST',
    body: { outletId, platform, externalMerchantId },
  });
  revalidatePath('/delivery');
}

export async function triggerMenuSync(): Promise<void> {
  await apiFetch('/v1/delivery/sync-menu', { method: 'POST' });
  revalidatePath('/delivery');
}
