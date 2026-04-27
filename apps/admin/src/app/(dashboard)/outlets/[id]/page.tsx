import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { deleteOutlet, updateOutlet } from '../actions';
import { OutletForm } from '../outlet-form';

type Outlet = {
  id: string;
  name: string;
  code: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  phone: string | null;
  serviceChargeBps: number;
  ppnBpsOverride: number | null;
};

export const dynamic = 'force-dynamic';

export default async function EditOutletPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let outlet: Outlet | null = null;
  try {
    const r = await apiFetch<{ outlet: Outlet }>(`/v1/outlets/${id}`);
    outlet = r.outlet;
  } catch {
    /* fallthrough */
  }
  if (!outlet) notFound();

  const update = updateOutlet.bind(null, outlet.id);
  const remove = deleteOutlet.bind(null, outlet.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/outlets" className="text-sm text-emerald-700 hover:underline">
            ← Cabang
          </Link>
          <h1 className="mt-2 text-2xl font-semibold">{outlet.name}</h1>
        </div>
        <form action={remove}>
          <button
            type="submit"
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Nonaktifkan
          </button>
        </form>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <OutletForm
          action={update}
          defaults={{
            name: outlet.name,
            code: outlet.code,
            addressLine1: outlet.addressLine1,
            addressLine2: outlet.addressLine2 ?? undefined,
            city: outlet.city,
            province: outlet.province,
            postalCode: outlet.postalCode ?? undefined,
            phone: outlet.phone ?? undefined,
            serviceChargeBps: outlet.serviceChargeBps,
            ppnBpsOverride: outlet.ppnBpsOverride,
          }}
          submitLabel="Simpan perubahan"
        />
      </div>
    </div>
  );
}
