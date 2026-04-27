import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { deleteGroup, updateGroup } from '../actions';
import { GroupForm } from '../group-form';

type Modifier = { id: string; name: string; priceDelta: string; isDefault: boolean; sortOrder: number };
type Group = {
  id: string;
  name: string;
  selectionMin: number;
  selectionMax: number;
  required: boolean;
  modifiers: Modifier[];
};

export const dynamic = 'force-dynamic';

export default async function EditGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let group: Group | null = null;
  try {
    const r = await apiFetch<{ items: Group[] }>('/v1/menu/modifier-groups');
    group = r.items.find((g) => g.id === id) ?? null;
  } catch {
    /* fallthrough */
  }
  if (!group) notFound();

  const update = updateGroup.bind(null, group.id);
  const remove = deleteGroup.bind(null, group.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/menu/modifiers" className="text-sm text-emerald-700 hover:underline">
            ← Modifier groups
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{group.name}</h1>
        </div>
        <form action={remove}>
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Hapus
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <GroupForm
          action={update}
          defaults={{
            name: group.name,
            selectionMin: group.selectionMin,
            selectionMax: group.selectionMax,
            required: group.required,
            modifiers: group.modifiers.map((m) => ({
              id: m.id,
              name: m.name,
              priceDeltaRupiah: Number(BigInt(m.priceDelta) / BigInt(100)),
              isDefault: m.isDefault,
              sortOrder: m.sortOrder,
            })),
          }}
          submitLabel="Simpan perubahan"
        />
      </div>
    </div>
  );
}
