'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

const CategoryForm = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export type CategoryFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> }
  | { status: 'success'; id: string };

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const k = issue.path.join('.');
    if (k && !out[k]) out[k] = issue.message;
  }
  return out;
}

export async function createCategory(
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = CategoryForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: 'Form belum lengkap.', fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    const r = await apiFetch<{ category: { id: string } }>('/v1/menu/categories', {
      method: 'POST',
      body: parsed.data,
    });
    revalidatePath('/menu');
    revalidatePath('/menu/categories');
    redirect(`/menu/categories/${r.category.id}`);
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function updateCategory(
  catId: string,
  _prev: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = CategoryForm.partial().safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { status: 'error', message: 'Form tidak valid.', fieldErrors: fieldErrors(parsed.error) };
  }
  try {
    await apiFetch(`/v1/menu/categories/${catId}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/menu');
    revalidatePath('/menu/categories');
    return { status: 'success', id: catId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function deleteCategory(catId: string): Promise<void> {
  // Throws on conflict (category not empty); the parent error boundary surfaces it.
  await apiFetch(`/v1/menu/categories/${catId}`, { method: 'DELETE' });
  revalidatePath('/menu');
  revalidatePath('/menu/categories');
  redirect('/menu/categories');
}
