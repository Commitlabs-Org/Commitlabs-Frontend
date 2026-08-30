/**
 * React hook for transaction lifecycle management.
 * Integrates state machine, polling, persistence, and telemetry for settlement and early-exit operations.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  TransactionMetadata,
  TransactionState,
  TransactionType,
  TransactionResult,
  PollingConfig,
} from '@/lib/transaction/transactionTypes';
import {
  DEFAULT_POLLING_CONFIG,
  TRANSACTION_BOUNDS,
} from '@/lib/transaction/transactionTypes';
import { TransactionStateMachine } from '@/lib/transaction/transactionStateMachine';
import {
  saveTransaction,
  loadTransaction,
  updateTransactionState,
  hasActiveTransaction,
  getLatestTransaction,
  initializePersistence,
} from '@/lib/transaction/transactionPersistence';
import {
  pollWithBounds,
  createTimeoutAbortController,
} from '@/lib/transaction/transactionPolling';
import {
  createTelemetryEvent,
  recordTelemetryEvent,
  getTransactionDiagnostics,
} from '@/lib/transaction/transactionTelemetry';

export interface UseTransactionLifecycleOptions {
  /** Commitment ID */
  commitmentId: string;
  /** Transaction type */
  transactionType: TransactionType;
  /** Polling configuration */
  pollingConfig?: Partial<PollingConfig>;
  /** Whether to enable persistence */
  enablePersistence?: boolean;
  /** Whether to enable telemetry */
  enableTelemetry?: boolean;
}

export interface TransactionLifecycleState {
  /** Current transaction state */
  state: TransactionState;
  /** Whether transaction is in progress */
  isProcessing: boolean;
  /** Transaction ID */
  transactionId: string | null;
  /** Transaction hash */
  txHash: string | null;
  /** Error message if failed */
  error: string | null;
  /** Retry count */
  retryCount: number;
  /** Transaction result data */
  result: TransactionResult | null;
}

export interface TransactionLifecycleActions {
  /** Start a new transaction */
  startTransaction: (params: { callerAddress?: string }) => Promise<void>;
  /** Retry a failed transaction */
  retryTransaction: () => Promise<void>;
  /** Cancel current transaction */
  cancelTransaction: () => void;
  /** Clear transaction state */
  clearTransaction: () => void;
  /** Get transaction diagnostics */
  getDiagnostics: () => ReturnType<typeof getTransactionDiagnostics>;
}

export function useTransactionLifecycle(
  options: UseTransactionLifecycleOptions,
): [TransactionLifecycleState, TransactionLifecycleActions] {
  const {
    commitmentId,
    transactionType,
    pollingConfig,
    enablePersistence = true,
    enableTelemetry = true,
  } = options;

  // State machine instance
  const stateMachineRef = useRef<TransactionStateMachine | null>(null);
  
  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // React state for UI
  const [state, setState] = useState<TransactionState>('idle');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<TransactionResult | null>(null);

  // Initialize persistence on mount
  useEffect(() => {
    if (enablePersistence) {
      initializePersistence();
    }
  }, [enablePersistence]);

  // Load existing transaction on mount
  useEffect(() => {
    if (!enablePersistence) return;

    const existingTransaction = getLatestTransaction(commitmentId);
    if (existingTransaction && existingTransaction.type === transactionType) {
      // Restore state from persistence
      stateMachineRef.current = new TransactionStateMachine(existingTransaction.state);
      setState(existingTransaction.state);
      setTransactionId(existingTransaction.id);
      setTxHash(existingTransaction.txHash ?? null);
      setError(existingTransaction.error ?? null);
      setRetryCount(existingTransaction.retryCount);
      
      // If transaction is in non-terminal state, resume polling
      if (!['idle', 'confirmed', 'failed'].includes(existingTransaction.state)) {
        resumeTransactionPolling(existingTransaction.id);
      }
    }
  }, [commitmentId, transactionType, enablePersistence]);

  /**
   * Resume polling for an existing transaction
   */
  const resumeTransactionPolling = useCallback(async (txId: string) => {
    if (!stateMachineRef.current) return;

    const abortController = createTimeoutAbortController(
      pollingConfig?.maxDurationMs ?? DEFAULT_POLLING_CONFIG.maxDurationMs,
    );
    abortControllerRef.current = abortController;

    try {
      const pollOptions: Parameters<typeof pollWithBounds>[0] = {
        pollFn: async () => {
          // Poll the transaction status from the API
          const response = await fetch(`/api/commitments/${commitmentId}/status`);
          if (!response.ok) {
            throw new Error('Failed to poll transaction status');
          }
          return response.json() as Promise<{ state: string; txHash?: string }>;
        },
        shouldStop: (data: unknown) => {
          const typedData = data as { state: string; txHash?: string };
          // Stop polling when transaction reaches terminal state
          return ['confirmed', 'failed', 'rejected'].includes(typedData.state);
        },
        signal: abortController.signal,
        transactionId: txId,
      };

      if (pollingConfig !== undefined) {
        pollOptions.config = pollingConfig;
      }

      const pollingResult = await pollWithBounds(pollOptions);

      if (pollingResult.success && pollingResult.data) {
        const typedData = pollingResult.data as { state: string; txHash?: string };
        // Update state based on polling result
        const newState = typedData.state as TransactionState;
        const transitionError = stateMachineRef.current.transition(newState);
        
        if (transitionError) {
          setError(transitionError.message);
        } else {
          setState(newState);
          if (enablePersistence) {
            const updateFields: Partial<TransactionMetadata> = {};
            if (typedData.txHash !== undefined) {
              updateFields.txHash = typedData.txHash;
            }
            updateTransactionState(txId, newState, updateFields);
          }
        }
      } else if (pollingResult.error) {
        setError(pollingResult.error.message);
        stateMachineRef.current.transition('failed');
        setState('failed');
        if (enablePersistence) {
          updateTransactionState(txId, 'failed', {
            error: pollingResult.error.message,
          });
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Polling failed';
      setError(errorMessage);
      stateMachineRef.current.transition('failed');
      setState('failed');
      if (enablePersistence) {
        updateTransactionState(txId, 'failed', { error: errorMessage });
      }
    }
  }, [commitmentId, pollingConfig, enablePersistence]);

  /**
   * Start a new transaction
   */
  const startTransaction = useCallback(async (params: { callerAddress?: string }) => {
    // Check for active transaction
    if (enablePersistence && hasActiveTransaction(commitmentId)) {
      throw new Error('An active transaction already exists for this commitment');
    }

    // Generate transaction ID
    const txId = `${transactionType}_${commitmentId}_${Date.now()}`;
    
    // Initialize state machine
    const stateMachine = new TransactionStateMachine('pending');
    stateMachineRef.current = stateMachine;

    // Update UI state
    setState('pending');
    setTransactionId(txId);
    setError(null);
    setRetryCount(0);
    setResult(null);

    // Record telemetry
    if (enableTelemetry) {
      recordTelemetryEvent(
        createTelemetryEvent('transaction_started', txId, transactionType, 'pending'),
      );
    }

    // Save initial state
    if (enablePersistence) {
      const additionalFields: Partial<TransactionMetadata> = {};
      if (params.callerAddress !== undefined) {
        additionalFields.callerAddress = params.callerAddress;
      }
      
      const metadata: TransactionMetadata = stateMachine.toMetadata(
        txId,
        transactionType,
        commitmentId,
        additionalFields,
      );
      saveTransaction(metadata);
    }

    try {
      // Call the appropriate API endpoint
      const endpoint = transactionType === 'settlement'
        ? `/api/commitments/${commitmentId}/settle`
        : `/api/commitments/${commitmentId}/early-exit`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...params,
          transactionId: txId,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Transition to confirming state
      const transitionError = stateMachine.transition('confirming');
      if (transitionError) {
        throw new Error(transitionError.message);
      }
      setState('confirming');

      // Update with response data
      setTxHash(data.txHash ?? null);
      setResult(data);

      if (enablePersistence) {
        updateTransactionState(txId, 'confirming', {
          txHash: data.txHash,
          settlementAmount: data.settlementAmount,
          exitAmount: data.exitAmount,
          penaltyAmount: data.penaltyAmount,
        });
      }

      // Start polling for confirmation
      await resumeTransactionPolling(txId);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transaction failed';
      setError(errorMessage);
      stateMachine.transition('failed');
      setState('failed');
      
      if (enablePersistence) {
        updateTransactionState(txId, 'failed', { error: errorMessage });
      }

      if (enableTelemetry) {
        recordTelemetryEvent(
          createTelemetryEvent('transaction_failed', txId, transactionType, 'failed', undefined, undefined, 'NETWORK_ERROR'),
        );
      }

      throw err;
    }
  }, [commitmentId, transactionType, enablePersistence, enableTelemetry, resumeTransactionPolling]);

  /**
   * Retry a failed transaction
   */
  const retryTransaction = useCallback(async () => {
    if (!transactionId || !stateMachineRef.current) {
      throw new Error('No transaction to retry');
    }

    if (!stateMachineRef.current.canRetry()) {
      throw new Error('Maximum retry attempts exceeded');
    }

    // Clear previous error
    setError(null);

    try {
      await startTransaction({});
    } catch (err) {
      // Error is already handled in startTransaction
      throw err;
    }
  }, [transactionId, startTransaction]);

  /**
   * Cancel current transaction
   */
  const cancelTransaction = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (stateMachineRef.current) {
      stateMachineRef.current.reset();
    }

    setState('idle');
    setTransactionId(null);
    setTxHash(null);
    setError(null);
    setRetryCount(0);
    setResult(null);

    if (transactionId && enablePersistence) {
      // Note: We don't delete the transaction, just mark as idle
      // This allows for recovery if needed
    }
  }, [transactionId, enablePersistence]);

  /**
   * Clear transaction state completely
   */
  const clearTransaction = useCallback(() => {
    cancelTransaction();
    
    if (transactionId && enablePersistence) {
      // Delete from persistence
      const key = `transaction_${transactionId}`;
      localStorage.removeItem(key);
    }
  }, [transactionId, cancelTransaction, enablePersistence]);

  /**
   * Get transaction diagnostics
   */
  const getDiagnostics = useCallback(() => {
    if (!transactionId) return null;
    return getTransactionDiagnostics(transactionId);
  }, [transactionId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const lifecycleState: TransactionLifecycleState = {
    state,
    isProcessing: ['pending', 'confirming'].includes(state),
    transactionId,
    txHash,
    error,
    retryCount,
    result,
  };

  const lifecycleActions: TransactionLifecycleActions = {
    startTransaction,
    retryTransaction,
    cancelTransaction,
    clearTransaction,
    getDiagnostics,
  };

  return [lifecycleState, lifecycleActions];
}
