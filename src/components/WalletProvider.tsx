'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { connectFreighter, type WalletState } from '@/lib/wallet';

interface Ctx extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<WalletState>({ status: 'idle', address: null, message: null });

  const connect = useCallback(async () => {
    setState({ status: 'connecting', address: null, message: null });
    setState(await connectFreighter());
  }, []);

  const disconnect = useCallback(() => {
    setState({ status: 'idle', address: null, message: null });
  }, []);

  const value = useMemo(() => ({ ...state, connect, disconnect }), [state, connect, disconnect]);
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): Ctx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used inside WalletProvider');
  return ctx;
}
