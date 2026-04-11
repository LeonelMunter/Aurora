import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/app/globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { AppProviders } from '@/providers/AppProviders';

export const metadata: Metadata = {
  title: 'Aurora',
  description: 'Plataforma financiera multi-mercado con IA',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
