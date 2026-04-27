import Link from 'next/link';
import { createOutlet } from '../actions';
import { OutletForm } from '../outlet-form';

export default function NewOutletPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <Link href="/outlets" className="text-sm text-emerald-700 hover:underline">
          ← Cabang
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Cabang baru</h1>
      </header>
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <OutletForm action={createOutlet} submitLabel="Buat cabang" />
      </div>
    </div>
  );
}
