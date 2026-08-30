'use client';

import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { QuickCreateFab } from './QuickCreateFab';
import { ShellNavigationBoundary } from './ShellNavigationBoundary';
import { useShellAuthState } from './useShellAuthState';

export function AppShellLayout({
  children,
  sessionSnapshot,
}: {
  children: ReactNode;
  sessionSnapshot?: unknown;
}) {
  const auth = useShellAuthState();

  return (
    <div className="flex min-h-screen bg-[#050505]">
      <AppSidebar auth={auth} />
      <main className="min-w-0 flex-1">
        <ShellNavigationBoundary auth={auth} sessionSnapshot={sessionSnapshot}>
          {children}
        </ShellNavigationBoundary>
      </main>
      <QuickCreateFab />
    </div>
  );
}
