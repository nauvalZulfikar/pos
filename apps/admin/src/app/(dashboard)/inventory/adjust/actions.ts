'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function adjustStock(formData: FormData): Promise<void> {
  const outletId = String(formData.get('outletId') ?? '');
  const inventoryItemId = String(formData.get('inventoryItemId') ?? '');
  const delta = Number(formData.get('delta') ?? '0');
  const reason = String(formData.get('reason') ?? '');

  if (!outletId || !inventoryItemId || !reason || Number.isNaN(delta)) {
    throw new Error('Form belum lengkap.');
  }

  await apiFetch('/v1/inventory/adjust', {
    method: 'POST',
    body: { outletId, inventoryItemId, delta, reason },
  });

  revalidatePath('/inventory');
}
