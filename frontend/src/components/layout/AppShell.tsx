'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Sidebar } from '@/components/layout/Sidebar';
import { TokenCounter } from '@/components/layout/TokenCounter';
import { SuggestionBot } from '@/components/suggestions/SuggestionBot';

const authRoutes = new Set(['/login', '/register']);

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideNavigation = authRoutes.has(pathname);
  const [generalBotOpen, setGeneralBotOpen] = useState(false);
  const generalSessionId = useMemo(() => 'general-chat', []);

  if (hideNavigation) {
    return <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">{children}</main>;
  }

  return (
    <>
      <div className="flex min-h-screen">
        <Sidebar onOpenGeneralChat={() => setGeneralBotOpen(true)} />
        <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-8 lg:px-10">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <SuggestionBot
        isOpen={generalBotOpen}
        onClose={() => setGeneralBotOpen(false)}
        sessionId={generalSessionId}
      />
      <TokenCounter />
    </>
  );
}
