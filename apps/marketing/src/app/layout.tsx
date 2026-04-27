import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'DESAIN POS — Sistem POS multi-cabang untuk restoran Indonesia',
  description:
    'POS modular dengan QRIS, integrasi GoFood/GrabFood/ShopeeFood, dan AI Daily Brief — dibangun untuk warung, kafe, dan multi-cabang.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body className="bg-white text-slate-900 antialiased">{children}</body>
    </html>
  );
}
