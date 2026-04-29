'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function transferStock(formData: FormData): Promise<void> {
  const fromOutletId = String(formData.get('fromOutletId') ?? '');
  const toOutletId = String(formData.get('toOutletId') ?? '');
  const inventoryItemId = String(formData.get('inventoryItemId') ?? '');
  const quantity = Number(formData.get('quantity') ?? '0');
  const reason = String(formData.get('reason') ?? '');

  if (
    !fromOutletId ||
    !toOutletId ||
    !inventoryItemId ||
    !reason ||
    !(quantity > 0)
  ) {
    throw new Error('Form belum lengkap atau jumlah harus > 0.');
  }
  if (fromOutletId === toOutletId) {
    throw new Error('Outlet asal & tujuan tidak boleh sama.');
  }

  await apiFetch('/v1/inventory/transfer', {
    method: 'POST',
    body: { fromOutletId, toOutletId, inventoryItemId, quantity, reason },
  });

  revalidatePath('/inventory');
}
