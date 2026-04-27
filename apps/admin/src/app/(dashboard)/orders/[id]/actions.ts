'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api';

export async function refundPayment(paymentId: string, formData: FormData): Promise<void> {
  const amountRupiah = Number(formData.get('amountRupiah') ?? '0');
  const reason = String(formData.get('reason') ?? '');
  if (!amountRupiah || amountRupiah < 1) throw new Error('Jumlah tidak valid');
  if (reason.length < 3) throw new Error('Alasan minimal 3 karakter');
  const amountSen = BigInt(Math.round(amountRupiah * 100));
  await apiFetch('/v1/payments/refund', {
    method: 'POST',
    body: { paymentId, amount: amountSen.toString(), reason },
  });
  revalidatePath('/orders');
}
