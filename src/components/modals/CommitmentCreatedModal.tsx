'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Eye,
  Loader2,
  X,
  Zap,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FundStep = 'idle' | 'funding' | 'success' | 'error' | 'skipped';

interface FundResult {
  txHash?: string;
  reference?: string;
  fundedAt?: string;
}

export interface CommitmentCreatedModalProps {
  isOpen: boolean;
  commitmentId: string;
  /** Optional connected-wallet address forwarded to the fund API. */
  callerAddress?: string;
  onViewCommitment: () => void;
  onCreateAnother: () => void;
  onClose: () => void;
  /** Called when the user chooses "Fund Later". If omitted, the button is hidden. */
  onFundLater?: () => void;
  onViewOnExplorer?: () => void;
}

// ─── Static content ───────────────────────────────────────────────────────────

const nextStepsAfterFund = [
  'Your commitment is now active and earning yield',
  'Monitor compliance and performance in your dashboard',
  'You can trade this commitment NFT in the marketplace',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'An unexpected error occurred. Please try again.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommitmentCreatedModal({
  isOpen,
  commitmentId,
  callerAddress,
  onViewCommitment,
  onCreateAnother,
  onClose,
  onFundLater,
  onViewOnExplorer,
}: CommitmentCreatedModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  // Fund state machine
  const [fundStep, setFundStep] = useState<FundStep>('idle');
  const [fundResult, setFundResult] = useState<FundResult | null>(null);
  const [fundError, setFundError] = useState<string | null>(null);

  // Reset fund state whenever the modal is opened fresh (new commitmentId)
  useEffect(() => {
    if (isOpen) {
      setFundStep('idle');
      setFundResult(null);
      setFundError(null);
    }
  }, [isOpen, commitmentId]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Focus trap + keyboard handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const focusTimer = window.setTimeout(() => {
      primaryButtonRef.current?.focus();
    }, 100);

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // ── Fund handler ─────────────────────────────────────────────────────────────

  const handleFund = useCallback(async () => {
    setFundStep('funding');
    setFundError(null);

    try {
      const res = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callerAddress }),
      });

      // 409 means it was already funded — treat as success
      if (res.status === 409 || res.ok) {
        const json = res.ok ? await res.json().catch(() => ({})) : {};
        const data: FundResult = json?.data ?? json ?? {};
        setFundResult(data);
        setFundStep('success');
        return;
      }

      // Surface a readable error from the response body
      let message = `Request failed with status ${res.status}.`;
      try {
        const errJson = await res.json();
        if (errJson?.error?.message) message = errJson.error.message;
        else if (errJson?.message) message = errJson.message;
      } catch {
        // ignore parse failures
      }

      if (res.status === 403) message = 'Only the commitment owner may fund this escrow.';
      if (res.status === 429) message = 'Too many requests. Please wait a moment then try again.';

      setFundError(message);
      setFundStep('error');
    } catch (err) {
      setFundError(errorMessage(err));
      setFundStep('error');
    }
  }, [commitmentId, callerAddress]);

  const handleSkip = useCallback(() => {
    setFundStep('skipped');
    onFundLater?.();
  }, [onFundLater]);

  const handleRetry = useCallback(() => {
    setFundStep('idle');
    setFundError(null);
  }, []);

  // ── Render guard ──────────────────────────────────────────────────────────────

  if (!isOpen || !mounted) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // ── Sub-views ─────────────────────────────────────────────────────────────────

  const renderFundPrompt = () => (
    <div
      className="rounded-[20px] border border-[#0FF0FC]/20 bg-[#0FF0FC]/5 p-5"
      role="region"
      aria-label="Fund your commitment"
    >
      <div className="mb-3 flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#0FF0FC]" />
        <span className="text-[13px] font-bold uppercase tracking-widest text-[#0FF0FC]">
          Fund Escrow to Activate
        </span>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-white/60">
        Your commitment has been created but is not yet active. Fund the escrow
        now to start earning yield. You can also fund later from the detail page.
      </p>
      <div className="flex gap-3">
        <button
          ref={primaryButtonRef}
          type="button"
          onClick={handleFund}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#0FF0FC] py-3 text-[14px] font-bold text-black transition-all shadow-[0_0_20px_rgba(15,240,252,0.3)] hover:scale-[1.01] hover:bg-[#0FF0FC]/90 active:scale-[0.98]"
          aria-label="Fund escrow now"
        >
          <Zap className="h-4 w-4" />
          Fund Now
        </button>
        {onFundLater && (
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[14px] font-bold text-white/70 transition-all hover:bg-white/10 active:scale-[0.98]"
            aria-label="Skip funding and fund later"
          >
            Fund Later
          </button>
        )}
      </div>
    </div>
  );

  const renderFunding = () => (
    <div
      className="rounded-[20px] border border-white/10 bg-white/5 p-6 text-center"
      role="status"
      aria-live="polite"
      aria-label="Funding in progress"
    >
      <Loader2
        className="mx-auto mb-3 h-8 w-8 animate-spin text-[#0FF0FC]"
        aria-hidden="true"
      />
      <p className="text-[14px] font-medium text-white/70">
        Funding escrow on-chain…
      </p>
      <p className="mt-1 text-[12px] text-white/30">This may take a few seconds</p>
    </div>
  );

  const renderFundSuccess = () => (
    <div
      className="rounded-[20px] border border-emerald-500/30 bg-emerald-500/10 p-5"
      role="status"
      aria-live="polite"
      aria-label="Escrow funded successfully"
    >
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-400" />
        <span className="text-[13px] font-bold uppercase tracking-widest text-emerald-400">
          Escrow Funded
        </span>
      </div>
      <p className="text-[13px] text-white/60">
        Your commitment is now active and earning yield.
      </p>
      {fundResult?.txHash && (
        <p className="mt-2 break-all font-mono text-[11px] text-white/30">
          Tx: {fundResult.txHash}
        </p>
      )}
    </div>
  );

  const renderFundError = () => (
    <div
      className="rounded-[20px] border border-rose-500/30 bg-rose-500/10 p-5"
      role="alert"
      aria-live="assertive"
      aria-label="Funding failed"
    >
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-rose-400" />
        <span className="text-[13px] font-bold uppercase tracking-widest text-rose-400">
          Funding Failed
        </span>
      </div>
      <p className="mb-4 text-[13px] leading-relaxed text-white/60">{fundError}</p>
      <div className="flex gap-3">
        <button
          ref={primaryButtonRef}
          type="button"
          onClick={handleRetry}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-rose-500/20 py-2.5 text-[13px] font-bold text-rose-300 transition-all hover:bg-rose-500/30 active:scale-[0.98]"
          aria-label="Retry funding"
        >
          Retry
        </button>
        {onFundLater && (
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-2.5 text-[13px] font-bold text-white/70 transition-all hover:bg-white/10 active:scale-[0.98]"
            aria-label="Skip and fund later from the detail page"
          >
            Fund Later
          </button>
        )}
      </div>
    </div>
  );

  const renderSkipped = () => (
    <div
      className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4"
      role="status"
      aria-live="polite"
      aria-label="Funding skipped"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p className="text-[13px] leading-relaxed text-white/60">
          Commitment is not yet active. You can fund the escrow anytime from the
          commitment detail page.
        </p>
      </div>
    </div>
  );

  const isFundSuccess = fundStep === 'success';
  const showNextSteps = isFundSuccess;

  // ── Full render ───────────────────────────────────────────────────────────────

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={modalRef}
        className="relative flex max-h-[100dvh] w-full max-w-[540px] flex-col overflow-y-auto rounded-[32px] border border-white/10 bg-[#0A0A0A] shadow-2xl animate-in slide-in-from-bottom-8 duration-500 ease-out sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="commitment-created-title"
        aria-describedby="commitment-created-description"
      >
        {/* Close button */}
        <div className="absolute right-6 top-6 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-white/50" />
          </button>
        </div>

        <div className="flex-1 px-6 pb-10 pt-12 sm:px-10">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center">
            <div className="relative mb-6 h-20 w-20 sm:h-24 sm:w-24">
              <div className="absolute inset-0 rounded-full bg-[#0FF0FC] opacity-20 blur-2xl animate-pulse" />
              <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full border-2 border-[#0FF0FC] bg-[#0FF0FC]/10 shadow-[inset_0_0_20px_rgba(15,240,252,0.2)]">
                <CheckCircle
                  className="h-10 w-10 text-[#0FF0FC] sm:h-12 sm:w-12"
                  strokeWidth={2.5}
                />
              </div>
            </div>
          </div>

            <div className="text-center">
              <h2
                id="commitment-created-title"
                className="mb-2 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]"
              >
                Commitment Created
              </h2>
              <p
                id="commitment-created-description"
                className="mx-auto max-w-[340px] text-[15px] font-medium leading-relaxed text-white/50 sm:text-[16px]"
              >
                {isFundSuccess
                  ? 'Your commitment is now active and available in your dashboard.'
                  : 'Complete the funding step to activate your commitment.'}
              </p>
            </div>

          {/* Commitment ID */}
          <div className="group relative mb-6 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center transition-colors hover:bg-white/[0.05]">
            <div className="absolute -mr-12 -mt-12 right-0 top-0 h-24 w-24 rounded-full bg-[#0FF0FC] opacity-[0.02] blur-2xl transition-opacity group-hover:opacity-[0.04]" />
            <div className="mb-3 ml-1 text-[13px] font-bold uppercase tracking-[0.2em] text-white/40">
              Commitment ID
            </div>
            <div className="break-all rounded-xl border border-white/5 bg-white/5 px-4 py-3 font-mono text-[14px] font-bold tracking-wider text-[#0FF0FC] sm:text-[16px]">
              {commitmentId}
            </div>
          </div>

          {/* Fund step region */}
          <div className="mb-8">
            {fundStep === 'idle' && renderFundPrompt()}
            {fundStep === 'funding' && renderFunding()}
            {fundStep === 'success' && renderFundSuccess()}
            {fundStep === 'error' && renderFundError()}
            {fundStep === 'skipped' && renderSkipped()}
          </div>

          {/* Next steps — only after successful funding */}
          {showNextSteps && (
            <div className="mb-8 lg:px-2">
              <h3 className="mb-5 ml-1 text-[14px] font-bold uppercase tracking-widest text-white/90">
                Next Steps
              </h3>
              <div className="space-y-4">
                {nextStepsAfterFund.map((s) => (
                  <div key={s} className="flex items-start gap-4 p-1">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#0FF0FC]/30 bg-[#0FF0FC]/10">
                      <CheckCircle className="h-3 w-3 text-[#0FF0FC]" strokeWidth={3} />
                    </div>
                    <span className="text-[14px] font-medium leading-relaxed text-white/70 sm:text-[15px]">
                      {s}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            {/* "View Commitment" is primary after success or skipped; hidden while funding */}
            {(isFundSuccess || fundStep === 'skipped') && (
              <button
                ref={fundStep !== 'error' && fundStep !== 'idle' ? primaryButtonRef : undefined}
                type="button"
                onClick={onViewCommitment}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0FF0FC] py-4 text-[16px] font-bold text-black transition-all shadow-[0_0_30px_rgba(15,240,252,0.3)] hover:scale-[1.01] hover:bg-[#0FF0FC]/90 active:scale-[0.98]"
                aria-label="View commitment detail"
              >
                <Eye className="h-5 w-5" />
                View Commitment
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCreateAnother}
                disabled={fundStep === 'funding'}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                aria-label="Create another commitment"
              >
                <span className="opacity-70">Create Another</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={fundStep === 'funding'}
                className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
                aria-label="Close"
              >
                Close
              </button>
            </div>
          </div>

          {onViewOnExplorer && (
            <div className="mt-8 border-t border-white/5 pt-6">
              <button
                type="button"
                onClick={onViewOnExplorer}
                className="flex w-full items-center justify-center gap-2 py-1 text-[13px] text-white/30 transition-colors hover:text-[#0FF0FC]"
                aria-label="View on Stellar Explorer"
              >
                View on Stellar Explorer
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
