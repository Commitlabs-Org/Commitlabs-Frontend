import type { ReactNode } from 'react';
import { AppSidebar } from './AppSidebar';
import { QuickCreateFab } from './QuickCreateFab';

export function AppShellLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#050505]">
      <AppSidebar />
      <main className="min-w-0 flex-1">{children}</main>
      <QuickCreateFab />
    </div>
  );
}
