import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/overview', label: 'Ringkasan', section: 'main' },
  { href: '/menu', label: 'Menu', section: 'main' },
  { href: '/inventory', label: 'Stok', section: 'main' },
  { href: '/customers', label: 'Pelanggan', section: 'main' },
  { href: '/orders', label: 'Order', section: 'main' },
  { href: '/reports', label: 'Laporan', section: 'main' },
  { href: '/delivery', label: 'Delivery', section: 'main' },
  { href: '/ai', label: 'AI Brief', section: 'main' },
  { href: '/outlets', label: 'Cabang', section: 'admin' },
  { href: '/staff', label: 'Tim', section: 'admin' },
  { href: '/vouchers', label: 'Voucher', section: 'admin' },
  { href: '/suppliers', label: 'Supplier', section: 'admin' },
  { href: '/audit', label: 'Audit Log', section: 'admin' },
  { href: '/settings', label: 'Pengaturan', section: 'admin' },
] as const;

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4">
          <Link href="/overview" className="text-lg font-bold text-emerald-700">
            DESAIN POS
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          <span className="mb-1 px-3 text-xs uppercase tracking-wider text-slate-400">
            Operasional
          </span>
          {NAV.filter((n) => n.section === 'main').map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
          <span className="mb-1 mt-3 px-3 text-xs uppercase tracking-wider text-slate-400">
            Admin
          </span>
          {NAV.filter((n) => n.section === 'admin').map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
