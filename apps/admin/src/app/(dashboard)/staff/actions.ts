'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

const InviteForm = z.object({
  email: z.string().email(),
  fullName: z.string().min(1).max(120),
  phone: z.string().regex(/^\+?\d{8,15}$/).optional().or(z.literal('')),
  role: z.enum(['owner', 'manager', 'kasir', 'dapur']),
  pin: z.string().regex(/^\d{4}$/).optional().or(z.literal('')),
  password: z.string().min(8).max(72).optional().or(z.literal('')),
});

export type InviteFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; userId: string };

export async function inviteStaff(_prev: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const parsed = InviteForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: 'Form belum lengkap.' };
  }
  try {
    await apiFetch('/v1/staff/invite', {
      method: 'POST',
      body: {
        email: parsed.data.email,
        fullName: parsed.data.fullName,
        phone: parsed.data.phone || null,
        role: parsed.data.role,
        pin: parsed.data.pin || null,
        password: parsed.data.password || null,
      },
    });
    revalidatePath('/staff');
    redirect('/staff');
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function setPin(userId: string, formData: FormData): Promise<void> {
  const pin = formData.get('pin')?.toString();
  if (!pin || !/^\d{4}$/.test(pin)) throw new Error('PIN harus 4 digit');
  await apiFetch(`/v1/staff/${userId}/pin`, { method: 'POST', body: { pin } });
  revalidatePath('/staff');
  revalidatePath(`/staff/${userId}`);
}

export async function deactivateStaff(userId: string): Promise<void> {
  await apiFetch(`/v1/staff/${userId}`, { method: 'DELETE' });
  revalidatePath('/staff');
  redirect('/staff');
}

type OutletOverride = { outletId: string; permissions: string[] };

export async function setOutletPermissions(
  userId: string,
  overrides: OutletOverride[],
): Promise<void> {
  await apiFetch(`/v1/staff/${userId}`, {
    method: 'PATCH',
    body: { outletPermissions: overrides },
  });
  revalidatePath(`/staff/${userId}`);
}
