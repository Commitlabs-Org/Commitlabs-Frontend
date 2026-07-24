'use client';

import { type ReactNode } from 'react';

import { ConnectionStatusBanner } from '@/components/shell/ConnectionStatusBanner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

interface AppShellConnectionStatusProps {
  children: ReactNode;
}

export function AppShellConnectionStatus({ children }: AppShellConnectionStatusProps) {
  const { isOnline } = useOnlineStatus();

  return (
    <>
      <ConnectionStatusBanner isOnline={isOnline} />
      {children}
    </>
  );
}
