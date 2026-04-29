'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function reportWaste(formData: FormData): Promise<void> {
  const outletId = String(formData.get('outletId') ?? '');
  const inventoryItemId = String(formData.get('inventoryItemId') ?? '');
  const quantity = Number(formData.get('quantity') ?? '0');
  const reason = String(formData.get('reason') ?? '');

  if (!outletId || !inventoryItemId || !reason || !(quantity > 0)) {
    throw new Error('Form belum lengkap atau jumlah harus > 0.');
  }

  await apiFetch('/v1/waste', {
    method: 'POST',
    body: { outletId, inventoryItemId, quantity, reason },
  });

  revalidatePath('/inventory/waste');
}
