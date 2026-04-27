import Link from 'next/link';
import { createGroup } from '../actions';
import { GroupForm } from '../group-form';

export const dynamic = 'force-dynamic';

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link href="/menu/modifiers" className="text-sm text-emerald-700 hover:underline">
          ← Modifier groups
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Modifier group baru</h1>
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <GroupForm action={createGroup} submitLabel="Buat group" />
      </div>
    </div>
  );
}
