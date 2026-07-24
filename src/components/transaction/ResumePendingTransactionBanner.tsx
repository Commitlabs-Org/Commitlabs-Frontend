'use client';

import React, { useEffect, useState } from 'react';
import type { TransactionTimelinePhase } from './TransactionStepTimeline';

const STORAGE_KEY = 'pending_transaction';

export interface PendingTransactionState {
  commitmentId: string;
  phase: TransactionTimelinePhase;
  startedAt: string;
  txHash?: string;
}

interface ResumePendingTransactionBannerProps {
  /** Called when the user clicks "Resume". */
  onResume: (state: PendingTransactionState) => void;
  /** Called when the user dismisses the banner. */
  onDismiss?: () => void;
}

/**
 * Reads a pending transaction from sessionStorage and shows a banner to let
 * the user resume it. Call `ResumePendingTransactionBanner.save(state)` from
 * the transaction flow to persist the current step.
 */
export function ResumePendingTransactionBanner({
  onResume,
  onDismiss,
}: ResumePendingTransactionBannerProps) {
  const [pending, setPending] = useState<PendingTransactionState | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setPending(JSON.parse(raw));
    } catch {
      // ignore
    }
  }, []);

  if (!pending) return null;

  const elapsed = Math.round(
    (Date.now() - new Date(pending.startedAt).getTime()) / 1000,
  );
  const elapsedLabel = elapsed < 60 ? `${elapsed}s ago` : `${Math.round(elapsed / 60)}m ago`;

  const handleResume = () => {
    onResume(pending);
  };

  const handleDismiss = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setPending(null);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
        <p className="text-amber-200 truncate">
          Pending transaction on commitment{' '}
          <strong className="font-semibold">#{pending.commitmentId}</strong>{' '}
          — paused at <span className="capitalize">{pending.phase}</span>{' '}
          <span className="text-amber-400/70">({elapsedLabel})</span>
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleResume}
          className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          Resume
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss pending transaction banner"
          className="text-amber-400/70 hover:text-amber-200 focus:outline-none focus:underline text-xs"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

ResumePendingTransactionBanner.save = (state: PendingTransactionState) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

ResumePendingTransactionBanner.clear = () => {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
