'use client';

import { useMemo } from 'react';
import { useWallet } from '@/hooks/useWallet';
import type { ShellAuthInput } from '@/lib/shell/navigationBoundary';

const EXPECTED_NETWORK =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE?.trim() || 'Test SDF Network ; September 2015'
    : 'Test SDF Network ; September 2015';

type WalletSlice = {
  address?: string | null;
  connected?: boolean;
  isConnected?: boolean;
  walletNetwork?: string | null;
  networkPassphrase?: string | null;
  network?: string | null;
};

/**
 * Projects wallet state into the shell boundary input.
 * The connected flag is informational only; the boundary re-checks address + network.
 */
export function useShellAuthState(): ShellAuthInput {
  const wallet = useWallet() as WalletSlice;

  return useMemo(
    () => ({
      address: wallet.address ?? null,
      connected: Boolean((wallet.connected ?? wallet.isConnected) && wallet.address),
      networkPassphrase: wallet.walletNetwork ?? wallet.networkPassphrase ?? wallet.network ?? null,
      expectedNetworkPassphrase: EXPECTED_NETWORK,
    }),
    [
      wallet.address,
      wallet.connected,
      wallet.isConnected,
      wallet.walletNetwork,
      wallet.networkPassphrase,
      wallet.network,
    ],
  );
}
