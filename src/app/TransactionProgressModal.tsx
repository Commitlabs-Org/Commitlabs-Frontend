'use client';

import React from 'react';
import TransactionStepTimeline, { type TransactionTimelinePhase } from '@/components/transaction/TransactionStepTimeline';
import { buildExplorerUrl, openExplorerUrl } from '@/utils/explorerLinks';

export type TransactionState =
  | 'IDLE'
  | 'AWAITING_SIGNATURE'
  | 'SUBMITTING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'ERROR';

const RESTORABLE_TRANSACTION_STATES = [
  'AWAITING_SIGNATURE',
  'SUBMITTING',
  'PROCESSING',
  'ERROR',
] as const;

type RestorableTransactionState = (typeof RESTORABLE_TRANSACTION_STATES)[number];
type ActiveTransactionState = Exclude<TransactionState, 'IDLE'>;

export interface TransactionProgressModalProps {
  isOpen: boolean;
  state: TransactionState;
  actionName: string; // e.g., "Settling Funds", "Creating Commitment"
  successMessage?: string; // Optional override for success helper text
  txHash?: string;
  errorCode?: string; // Mapped to our UX outcomes
  onClose: () => void;
  onRetry?: () => void;
  onSuccessAction?: () => void; // e.g., "View Details"
}

interface PersistedTransactionSnapshot {
  state: RestorableTransactionState;
  actionName: string;
  successMessage?: string;
  txHash?: string;
  errorCode?: string;
}

interface ActiveTransactionSnapshot {
  state: ActiveTransactionState;
  actionName: string;
  successMessage: string;
  txHash?: string;
  errorCode: string;
}

const TRANSACTION_PROGRESS_STORAGE_KEY =
  'commitlabs.transactionProgressModal.v1';

function getTransactionProgressStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRestorableTransactionState(
  value: unknown,
): value is RestorableTransactionState {
  return RESTORABLE_TRANSACTION_STATES.includes(
    value as RestorableTransactionState,
  );
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function readPersistedTransactionSnapshot(): PersistedTransactionSnapshot | null {
  const storage = getTransactionProgressStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(TRANSACTION_PROGRESS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    if (!isRestorableTransactionState(parsed.state)) return null;
    if (typeof parsed.actionName !== 'string' || !parsed.actionName.trim()) {
      return null;
    }

    return {
      state: parsed.state,
      actionName: parsed.actionName,
      successMessage: optionalString(parsed.successMessage),
      txHash: optionalString(parsed.txHash),
      errorCode: optionalString(parsed.errorCode),
    };
  } catch {
    return null;
  }
}

function writePersistedTransactionSnapshot(
  snapshot: PersistedTransactionSnapshot,
) {
  const storage = getTransactionProgressStorage();
  if (!storage) return;

  try {
    storage.setItem(
      TRANSACTION_PROGRESS_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  } catch {
    // Storage may be unavailable in private mode or locked-down browsers.
  }
}

function clearPersistedTransactionSnapshot() {
  const storage = getTransactionProgressStorage();
  if (!storage) return;

  try {
    storage.removeItem(TRANSACTION_PROGRESS_STORAGE_KEY);
  } catch {
    // Treat storage cleanup failures as non-fatal UI concerns.
  }
}

const ERROR_MAPPINGS: Record<string, { type: 'error' | 'warning'; lead: string; helper: string; primary: string; secondary: string }> = {
  USER_REJECTED: {
    type: 'warning',
    lead: 'Signature Canceled',
    helper: 'You declined the transaction in Freighter. No funds were moved.',
    primary: 'Try Again',
    secondary: 'Close',
  },
  INSUFFICIENT_BALANCE: {
    type: 'error',
    lead: 'Insufficient Balance',
    helper: "You don't have enough XLM or asset balance to complete this action.",
    primary: 'Fund Wallet',
    secondary: 'Close',
  },
  NETWORK_CONGESTION: {
    type: 'warning',
    lead: 'Network is Busy',
    helper: 'The Stellar network is experiencing high traffic. Please try again in a few moments.',
    primary: 'Try Again',
    secondary: 'Close',
  },
  RPC_TIMEOUT: {
    type: 'warning',
    lead: 'Status Unknown (Timeout)',
    helper: 'The network is taking longer than expected. Check the block explorer before retrying to prevent duplicate transactions.',
    primary: 'Check Explorer ↗',
    secondary: 'Close',
  },
  SLIPPAGE_EXCEEDED: {
    type: 'error',
    lead: 'Price Changed',
    helper: 'The market price moved beyond your allowed slippage during processing.',
    primary: 'Update Price',
    secondary: 'Cancel',
  },
  CONTRACT_REVERTED: {
    type: 'error',
    lead: 'Contract Execution Failed',
    helper: 'The smart contract rejected the transaction. The parameters may no longer be valid.',
    primary: 'View Details',
    secondary: 'Close',
  },
  UNKNOWN_ERROR: {
    type: 'error',
    lead: 'Unexpected Error',
    helper: 'An unknown error occurred. No funds were moved. Please try again.',
    primary: 'Try Again',
    secondary: 'Contact Support',
  },
};

export default function TransactionProgressModal({
  isOpen,
  state,
  actionName,
  successMessage = 'Your transaction has been successfully processed.',
  txHash,
  errorCode = 'UNKNOWN_ERROR',
  onClose,
  onRetry,
  onSuccessAction,
}: TransactionProgressModalProps) {
  const [timelinePhase, setTimelinePhase] = React.useState<TransactionTimelinePhase>('build');
  const [restoredSnapshot, setRestoredSnapshot] =
    React.useState<PersistedTransactionSnapshot | null>(null);

  const externalSnapshot = React.useMemo<ActiveTransactionSnapshot | null>(() => {
    if (!isOpen || state === 'IDLE') return null;

    return {
      state,
      actionName,
      successMessage,
      txHash,
      errorCode,
    };
  }, [actionName, errorCode, isOpen, state, successMessage, txHash]);
  const activeSnapshot = externalSnapshot ?? restoredSnapshot;
  const modalState = activeSnapshot?.state ?? state;
  const modalActionName = activeSnapshot?.actionName ?? actionName;
  const modalSuccessMessage =
    activeSnapshot?.successMessage ?? successMessage;
  const modalTxHash = activeSnapshot?.txHash;
  const modalErrorCode =
    activeSnapshot?.errorCode ?? errorCode ?? 'UNKNOWN_ERROR';

  React.useEffect(() => {
    if (!isOpen || state === 'IDLE') {
      setRestoredSnapshot(readPersistedTransactionSnapshot());
    }
  }, [isOpen, state]);

  React.useEffect(() => {
    if (!externalSnapshot) return;

    setRestoredSnapshot(null);

    if (externalSnapshot.state === 'SUCCESS') {
      clearPersistedTransactionSnapshot();
      return;
    }

    writePersistedTransactionSnapshot({
      state: externalSnapshot.state,
      actionName: externalSnapshot.actionName,
      successMessage: externalSnapshot.successMessage,
      txHash: externalSnapshot.txHash,
      errorCode: externalSnapshot.errorCode,
    });
  }, [externalSnapshot]);

  React.useEffect(() => {
    if (!activeSnapshot || modalState === 'IDLE') {
      setTimelinePhase('build');
      return;
    }

    if (modalState === 'AWAITING_SIGNATURE') {
      setTimelinePhase('sign');
      return;
    }

    if (modalState === 'SUBMITTING') {
      setTimelinePhase('submit');
      return;
    }

    if (modalState === 'PROCESSING' || modalState === 'SUCCESS') {
      setTimelinePhase('confirm');
      return;
    }

    if (modalState === 'ERROR') {
      setTimelinePhase((current) => (current === 'build' ? 'sign' : current));
    }
  }, [activeSnapshot, modalState]);

  if (!activeSnapshot || modalState === 'IDLE') return null;

  const txExplorerUrl = buildExplorerUrl('tx', modalTxHash);

  const handleClose = () => {
    clearPersistedTransactionSnapshot();
    setRestoredSnapshot(null);
    onClose();
  };

  const handleRetry = () => {
    clearPersistedTransactionSnapshot();
    setRestoredSnapshot(null);
    onRetry?.();
  };

  const handleSuccessAction = () => {
    clearPersistedTransactionSnapshot();
    setRestoredSnapshot(null);
    (onSuccessAction || onClose)();
  };

  const handleCopyHash = async (hash: string) => {
    if (!hash) return;

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(hash);
      } catch {
        // Ignore clipboard failures and keep the affordance available.
      }
    }
  };

  // -- State Configuration Helpers --
  const getHeader = () => {
    switch (modalState) {
      case 'AWAITING_SIGNATURE': return 'Confirm in Freighter';
      case 'SUBMITTING': return `${modalActionName} in Progress`;
      case 'PROCESSING': return 'Confirming Transaction';
      case 'SUCCESS': return `${modalActionName} Successful!`;
      case 'ERROR':
        return modalErrorCode === 'RPC_TIMEOUT' ? 'Network Timeout' : 'Transaction Failed';
      default: return 'Transaction in Progress';
    }
  };

  const getLeadText = () => {
    switch (modalState) {
      case 'AWAITING_SIGNATURE': return 'Please sign the transaction in your wallet.';
      case 'SUBMITTING': return 'Sending to the Stellar Network...';
      case 'PROCESSING': return 'Waiting for network confirmation...';
      case 'SUCCESS': return 'Your transaction has been confirmed.';
      case 'ERROR':
        return ERROR_MAPPINGS[modalErrorCode]?.lead || ERROR_MAPPINGS['UNKNOWN_ERROR'].lead;
      default: return '';
    }
  };

  const getHelperText = () => {
    switch (modalState) {
      case 'AWAITING_SIGNATURE': return "We're waiting for your approval to proceed.";
      case 'SUBMITTING': return "This usually takes 3-5 seconds. Please don't close this window.";
      case 'PROCESSING': return 'The transaction has been submitted and is waiting to be included in the ledger.';
      case 'SUCCESS': return modalSuccessMessage;
      case 'ERROR':
        return ERROR_MAPPINGS[modalErrorCode]?.helper || ERROR_MAPPINGS['UNKNOWN_ERROR'].helper;
      default: return '';
    }
  };

  // -- Visual Graphic Renderers --
  const renderGraphic = () => {
    if (modalState === 'AWAITING_SIGNATURE') {
      return (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white/5 border border-white/10 animate-pulse">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/80">
            <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
            <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
          </svg>
        </div>
      );
    }

    if (modalState === 'SUBMITTING' || modalState === 'PROCESSING') {
      return (
        <div className="flex items-center justify-center w-16 h-16">
          <svg className="animate-spin text-[#00C950]" width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
            <path d="M12 2C6.47715 2 2 6.47715 2 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    if (modalState === 'SUCCESS') {
      return (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[#00C950]/10 border border-[#00C950]/20">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C950" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      );
    }

    if (modalState === 'ERROR') {
      const errorType = ERROR_MAPPINGS[modalErrorCode]?.type || 'error';
      const color = errorType === 'warning' ? '#FF8904' : '#FF4757';
      const bgClass = errorType === 'warning' ? 'bg-[#FF8904]/10 border-[#FF8904]/20' : 'bg-[#FF4757]/10 border-[#FF4757]/20';

      return (
        <div className={`flex items-center justify-center w-16 h-16 rounded-full border ${bgClass}`}>
          {errorType === 'warning' ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" x2="12" y1="9" y2="13" />
              <line x1="12" x2="12.01" y1="17" y2="17" />
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" x2="9" y1="9" y2="15" />
              <line x1="9" x2="15" y1="9" y2="15" />
            </svg>
          )}
        </div>
      );
    }

    return null;
  };

  // -- Actions Renderer --
  const renderActions = () => {
    const inProgress = modalState === 'SUBMITTING' || modalState === 'PROCESSING';

    if (inProgress) {
      return null; // No actions allowed while broadcasting/mining to prevent desync
    }

    if (modalState === 'AWAITING_SIGNATURE') {
      return (
        <button onClick={handleClose} className="w-full py-3 px-4 rounded-lg font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
          Cancel
        </button>
      );
    }

    if (modalState === 'SUCCESS') {
      return (
        <div className="flex flex-col gap-3 w-full">
          <button onClick={handleSuccessAction} className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-[#00C950] hover:bg-[#00C950]/90 transition-colors">
            View Details
          </button>
          <button onClick={handleClose} className="w-full py-3 px-4 rounded-lg font-semibold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
            Close
          </button>
        </div>
      );
    }

    if (modalState === 'ERROR') {
      const mapping = ERROR_MAPPINGS[modalErrorCode] || ERROR_MAPPINGS['UNKNOWN_ERROR'];
      const isTimeout = modalErrorCode === 'RPC_TIMEOUT';

      const handlePrimaryClick = () => {
        if (isTimeout && txExplorerUrl) {
          openExplorerUrl('tx', modalTxHash);
        } else if (mapping.primary === 'Fund Wallet' || mapping.primary === 'Contact Support') {
           // Handle external redirect logic here if applicable, otherwise fallback to generic
          handleClose();
        } else {
          handleRetry();
        }
      };

      return (
        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={handlePrimaryClick} 
            className="w-full py-3 px-4 rounded-lg font-semibold text-white bg-white/10 hover:bg-white/20 transition-colors"
          >
            {mapping.primary}
          </button>
          <button onClick={handleClose} className="w-full py-3 px-4 rounded-lg font-semibold text-white/50 hover:text-white/80 transition-colors">
            {mapping.secondary}
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div 
        className="relative w-full max-w-md bg-[#121212] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <h2 id="progress-modal-title" className="text-lg font-semibold text-white/90">
            {getHeader()}
          </h2>
          {/* Only show close button if it's safe to cancel */}
          {modalState !== 'SUBMITTING' && modalState !== 'PROCESSING' && (
            <button 
              onClick={handleClose}
              className="p-1.5 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col items-center justify-center p-8 text-center">
          
          <div className="mb-6">
            {renderGraphic()}
          </div>

          <h3 className="text-xl font-bold text-white mb-2">
            {getLeadText()}
          </h3>
          
          <p className="text-sm text-white/60 max-w-[300px] leading-relaxed">
            {getHelperText()}
          </p>

          <TransactionStepTimeline
            currentPhase={timelinePhase}
            state={modalState === 'SUCCESS' ? 'success' : modalState === 'ERROR' ? 'error' : 'in_progress'}
            txHash={modalTxHash}
            onCopyHash={handleCopyHash}
          />

          {/* Explorer Link Slot */}
          {txExplorerUrl && (modalState === 'SUCCESS' || modalState === 'ERROR' || modalState === 'PROCESSING') && (
            <div className="mt-6 p-3 w-full rounded-lg bg-white/5 border border-white/5 flex items-center justify-between">
              <span className="text-xs text-white/40 font-mono truncate max-w-[200px]">
                {modalTxHash}
              </span>
              <a 
                href={txExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-white/70 hover:text-[#00C950] flex items-center gap-1.5 font-medium transition-colors"
              >
                View Explorer
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" x2="21" y1="14" y2="3" />
                </svg>
              </a>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {(modalState !== 'SUBMITTING' && modalState !== 'PROCESSING') && (
          <div className="px-6 pb-6 pt-2 flex flex-col items-center">
            {renderActions()}
          </div>
        )}
        
      </div>
    </div>
  );
}
