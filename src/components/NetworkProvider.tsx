'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { config as buildConfig, getActiveConfig, setActiveNetwork, type AppConfig } from '@/lib/config';
import {
  NETWORK_COOKIE,
  NETWORK_STORAGE_KEY,
  isNetworkId,
  type NetworkId,
} from '@/lib/network';
import { readRaw, writeRaw } from '@/lib/storage';

export interface NetworkContextValue {
  network: NetworkId;
  config: AppConfig;
  isContractConfigured: boolean;
  setNetwork: (network: NetworkId) => void;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

// localStorage is unavailable during SSR, so the initial sync must run in an
// effect on the client. A layout effect runs before child passive effects,
// which makes the active config correct before any page starts fetching.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

function persistNetwork(network: NetworkId): void {
  writeRaw(NETWORK_STORAGE_KEY, network);
  document.cookie = `${NETWORK_COOKIE}=${network}; path=/; max-age=31536000; samesite=lax`;
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [network, setNetworkState] = useState<NetworkId>(buildConfig.network);
  const [activeConfig, setConfigState] = useState<AppConfig>(buildConfig);

  const apply = useCallback((next: NetworkId) => {
    setActiveNetwork(next);
    setNetworkState(next);
    setConfigState(getActiveConfig());
  }, []);

  useIsomorphicLayoutEffect(() => {
    // Corrupt or unknown stored values fall back to the build-time default.
    const stored = readRaw(NETWORK_STORAGE_KEY);
    apply(isNetworkId(stored) ? stored : buildConfig.network);
    persistNetwork(isNetworkId(stored) ? stored : buildConfig.network);
  }, [apply]);

  const setNetwork = useCallback(
    (next: NetworkId) => {
      if (!isNetworkId(next)) return;
      apply(next);
      persistNetwork(next);
    },
    [apply],
  );

  const value = useMemo<NetworkContextValue>(
    () => ({
      network,
      config: activeConfig,
      isContractConfigured: activeConfig.isContractConfigured,
      setNetwork,
    }),
    [network, activeConfig, setNetwork],
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

/**
 * Reads the active network and its config. Falls back to the build-time config
 * when used outside a provider (for example in isolated component tests).
 */
export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) {
    return {
      network: buildConfig.network,
      config: buildConfig,
      isContractConfigured: buildConfig.isContractConfigured,
      setNetwork: () => {},
    };
  }
  return ctx;
}
