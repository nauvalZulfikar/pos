'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

const OutletForm = z.object({
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(20).regex(/^[A-Z0-9_-]+$/),
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(80),
  province: z.string().max(80),
  postalCode: z.string().max(10).optional(),
  phone: z.string().max(20).optional(),
  serviceChargeBps: z.coerce.number().int().min(0).max(2500).default(0),
  ppnBpsOverride: z.coerce.number().int().min(0).max(2500).optional(),
});

export type OutletFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; id: string };

export async function createOutlet(_prev: OutletFormState, formData: FormData): Promise<OutletFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = OutletForm.safeParse(raw);
  if (!parsed.success) {
    return { status: 'error', message: 'Form belum lengkap.' };
  }
  try {
    const r = await apiFetch<{ outlet: { id: string } }>('/v1/outlets', {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath('/outlets');
    redirect(`/outlets/${r.outlet.id}`);
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function updateOutlet(
  outletId: string,
  _prev: OutletFormState,
  formData: FormData,
): Promise<OutletFormState> {
  const parsed = OutletForm.partial().safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { status: 'error', message: 'Form tidak valid.' };
  try {
    await apiFetch(`/v1/outlets/${outletId}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/outlets');
    return { status: 'success', id: outletId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function deleteOutlet(outletId: string): Promise<void> {
  await apiFetch(`/v1/outlets/${outletId}`, { method: 'DELETE' });
  revalidatePath('/outlets');
  redirect('/outlets');
}
