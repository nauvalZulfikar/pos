'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

const MenuItemForm = z.object({
  categoryId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  sku: z.string().max(40).optional().nullable(),
  basePriceRupiah: z.coerce.number().nonnegative(),
  imageUrl: z.string().url().optional().nullable(),
  ppnBpsOverride: z.coerce.number().int().min(0).max(2500).optional().nullable(),
});

export type MenuItemFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }
  | { status: 'success'; id: string };

export async function createMenuItem(
  _prev: MenuItemFormState,
  formData: FormData,
): Promise<MenuItemFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = MenuItemForm.safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Form belum lengkap.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  try {
    const result = await apiFetch<{ item: { id: string } }>('/v1/menu/items', {
      method: 'POST',
      body: {
        categoryId: parsed.data.categoryId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        sku: parsed.data.sku ?? null,
        // Convert rupiah → sen (×100) and serialize bigint as string for JSON.
        basePrice: (BigInt(Math.round(parsed.data.basePriceRupiah * 100))).toString(),
        pricingByProfile: {},
        imageUrl: parsed.data.imageUrl ?? null,
        modifierGroupIds: [],
        ppnBpsOverride: parsed.data.ppnBpsOverride ?? null,
      },
    });
    revalidatePath('/menu');
    redirect(`/menu/${result.item.id}`);
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function updateMenuItem(
  itemId: string,
  _prev: MenuItemFormState,
  formData: FormData,
): Promise<MenuItemFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = MenuItemForm.partial().safeParse(raw);
  if (!parsed.success) {
    return {
      status: 'error',
      message: 'Form tidak valid.',
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }
  try {
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.basePriceRupiah !== undefined) {
      patch.basePrice = BigInt(Math.round(parsed.data.basePriceRupiah * 100)).toString();
      delete patch.basePriceRupiah;
    }
    await apiFetch(`/v1/menu/items/${itemId}`, { method: 'PATCH', body: patch });
    revalidatePath('/menu');
    revalidatePath(`/menu/${itemId}`);
    return { status: 'success', id: itemId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function deleteMenuItem(itemId: string): Promise<void> {
  await apiFetch(`/v1/menu/items/${itemId}`, { method: 'DELETE' });
  revalidatePath('/menu');
  redirect('/menu');
}

function zodFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.');
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
