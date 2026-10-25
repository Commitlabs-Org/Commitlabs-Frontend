'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ProtocolStatus } from '@/lib/soroban/protocol-policy';
import { config } from '@/lib/config';

export type ProtocolStatusState = 'loading' | 'ok' | 'unavailable';

export interface ProtocolStatusContextValue {
  status: ProtocolStatusState;
  paused: boolean;
  yieldPool: bigint;
  fetchedAt: number | null;
  refresh: () => Promise<void>;
}

const ProtocolStatusContext = createContext<ProtocolStatusContextValue | null>(null);

function afterPageLoad(): Promise<void> {
  if (typeof document === 'undefined' || document.readyState === 'complete') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

export function ProtocolStatusProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    status: ProtocolStatusState;
    paused: boolean;
    yieldPool: bigint;
    fetchedAt: number | null;
  }>({
    status: 'loading',
    paused: false,
    yieldPool: 0n,
    fetchedAt: null,
  });

  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    // One in-flight request at a time (dedupes concurrent calls)
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const task = (async () => {
      try {
        // Loaded on demand, after the page has finished loading, so stellar-sdk
        // stays out of the first-load bundle and does not compete with first paint.
        if (!config.escrowContractId) {
          // Nothing to read without a deployed contract; skip loading stellar-sdk.
          setState({ status: 'unavailable', paused: false, yieldPool: 0n, fetchedAt: Date.now() });
          return;
        }
        await afterPageLoad();
        const { getProtocolStatus } = await import('@/lib/soroban/protocol-status');
        const res: ProtocolStatus = await getProtocolStatus();
        setState({
          status: res.status,
          paused: res.paused,
          yieldPool: res.yieldPool,
          fetchedAt: res.fetchedAt,
        });
      } catch {
        // Fallback safety: RPC failure never blocks actions and never shows paused banner
        setState((prev) => ({
          status: 'unavailable',
          paused: false,
          yieldPool: 0n,
          fetchedAt: prev.fetchedAt ?? Date.now(),
        }));
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = task;
    return task;
  }, []);

  useEffect(() => {
    // Fetch on mount
    void refresh();

    // Poll every 60s while visible
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          void refresh();
        }
      }, 60_000);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'visible') {
        void refresh();
        startPolling();
      } else {
        stopPolling();
      }
    };

    const handleFocus = () => {
      void refresh();
    };

    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      startPolling();
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      stopPolling();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [refresh]);

  return (
    <ProtocolStatusContext.Provider
      value={{
        status: state.status,
        paused: state.paused,
        yieldPool: state.yieldPool,
        fetchedAt: state.fetchedAt,
        refresh,
      }}
    >
      {children}
    </ProtocolStatusContext.Provider>
  );
}

export function useProtocolStatus(): ProtocolStatusContextValue {
  const ctx = useContext(ProtocolStatusContext);
  if (!ctx) {
    return {
      status: 'unavailable',
      paused: false,
      yieldPool: 0n,
      fetchedAt: null,
      refresh: async () => {},
    };
  }
  return ctx;
}
