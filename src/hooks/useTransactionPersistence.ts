'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TransactionState } from '@/app/TransactionProgressModal';
import type { TransactionTimelinePhase } from '@/components/transaction/TransactionStepTimeline';

export interface PersistedTransactionState {
  state: TransactionState;
  timelinePhase: TransactionTimelinePhase;
  actionName: string;
  txHash?: string;
  errorCode?: string;
  successMessage?: string;
  savedAt: number;
}

const STORAGE_KEY = 'commitlabs-tx-progress';
const SCHEMA_VERSION = 1;
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

const TERMINAL_STATES: TransactionState[] = ['SUCCESS', 'IDLE'];

interface StorageEnvelope {
  version: number;
  data: PersistedTransactionState;
}

function readStorage(): PersistedTransactionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const envelope: StorageEnvelope = JSON.parse(raw);
    if (envelope.version !== SCHEMA_VERSION) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const { data } = envelope;
    if (Date.now() - data.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function writeStorage(data: PersistedTransactionState): void {
  try {
    const envelope: StorageEnvelope = { version: SCHEMA_VERSION, data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage unavailable — no-op
  }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable — no-op
  }
}

export function useTransactionPersistence() {
  const [rehydrated, setRehydrated] = useState<PersistedTransactionState | null>(null);

  useEffect(() => {
    const saved = readStorage();
    if (saved) setRehydrated(saved);
  }, []);

  const persist = useCallback((data: Omit<PersistedTransactionState, 'savedAt'>) => {
    if (TERMINAL_STATES.includes(data.state)) {
      clearStorage();
      return;
    }
    writeStorage({ ...data, savedAt: Date.now() });
  }, []);

  const clearPersisted = useCallback(() => {
    clearStorage();
    setRehydrated(null);
  }, []);

  return { rehydrated, persist, clearPersisted };
}
