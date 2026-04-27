'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { apiFetch } from '@/lib/api';

const ModifierLine = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  priceDeltaRupiah: z.coerce.number(),
  isDefault: z.coerce.boolean().default(false),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

const GroupForm = z.object({
  name: z.string().min(1).max(80),
  selectionMin: z.coerce.number().int().min(0).default(0),
  selectionMax: z.coerce.number().int().min(1).default(1),
  required: z.coerce.boolean().default(false),
  modifiers: z.array(ModifierLine).default([]),
});

function rupiahToSenString(rupiah: number): string {
  return BigInt(Math.round(rupiah * 100)).toString();
}

function parseFormDataLines(formData: FormData) {
  const out: Array<{
    id?: string;
    name: string;
    priceDeltaRupiah: number;
    isDefault: boolean;
    sortOrder: number;
  }> = [];
  const indices = new Set<number>();
  for (const key of formData.keys()) {
    const m = /^modifiers\[(\d+)\]\.name$/.exec(key);
    if (m) indices.add(Number(m[1]));
  }
  for (const i of [...indices].sort((a, b) => a - b)) {
    const name = formData.get(`modifiers[${i}].name`)?.toString() ?? '';
    if (!name) continue;
    out.push({
      id: formData.get(`modifiers[${i}].id`)?.toString() || undefined,
      name,
      priceDeltaRupiah: Number(formData.get(`modifiers[${i}].priceDeltaRupiah`) ?? '0'),
      isDefault: formData.get(`modifiers[${i}].isDefault`) === 'on',
      sortOrder: Number(formData.get(`modifiers[${i}].sortOrder`) ?? `${i}`),
    });
  }
  return out;
}

export type GroupFormState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'success'; id: string };

export async function createGroup(_prev: GroupFormState, formData: FormData): Promise<GroupFormState> {
  const parsed = GroupForm.safeParse({
    name: formData.get('name'),
    selectionMin: formData.get('selectionMin'),
    selectionMax: formData.get('selectionMax'),
    required: formData.get('required') === 'on',
    modifiers: parseFormDataLines(formData),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Form belum lengkap.' };
  }
  try {
    const r = await apiFetch<{ group: { id: string } }>('/v1/menu/modifier-groups', {
      method: 'POST',
      body: {
        name: parsed.data.name,
        selectionMin: parsed.data.selectionMin,
        selectionMax: parsed.data.selectionMax,
        required: parsed.data.required,
        modifiers: parsed.data.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceDelta: rupiahToSenString(m.priceDeltaRupiah),
          isDefault: m.isDefault,
          sortOrder: m.sortOrder,
        })),
      },
    });
    revalidatePath('/menu/modifiers');
    redirect(`/menu/modifiers/${r.group.id}`);
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function updateGroup(
  groupId: string,
  _prev: GroupFormState,
  formData: FormData,
): Promise<GroupFormState> {
  const parsed = GroupForm.safeParse({
    name: formData.get('name'),
    selectionMin: formData.get('selectionMin'),
    selectionMax: formData.get('selectionMax'),
    required: formData.get('required') === 'on',
    modifiers: parseFormDataLines(formData),
  });
  if (!parsed.success) {
    return { status: 'error', message: 'Form belum lengkap.' };
  }
  try {
    await apiFetch(`/v1/menu/modifier-groups/${groupId}`, {
      method: 'PATCH',
      body: {
        name: parsed.data.name,
        selectionMin: parsed.data.selectionMin,
        selectionMax: parsed.data.selectionMax,
        required: parsed.data.required,
        modifiers: parsed.data.modifiers.map((m) => ({
          id: m.id,
          name: m.name,
          priceDelta: rupiahToSenString(m.priceDeltaRupiah),
          isDefault: m.isDefault,
          sortOrder: m.sortOrder,
        })),
      },
    });
    revalidatePath('/menu/modifiers');
    revalidatePath(`/menu/modifiers/${groupId}`);
    return { status: 'success', id: groupId };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Gagal' };
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiFetch(`/v1/menu/modifier-groups/${groupId}`, { method: 'DELETE' });
  revalidatePath('/menu/modifiers');
  redirect('/menu/modifiers');
}
