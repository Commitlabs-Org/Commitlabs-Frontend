'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useWallet } from '@/hooks/useWallet';

type DisputeStatus = 'idle' | 'submitting' | 'success' | 'error';
type DisputeCategory = 'pricing' | 'non_compliance' | 'settlement_error' | 'other';

interface DisputeModalProps {
  isOpen: boolean;
  commitmentId: string;
  onClose: () => void;
  onSubmitted?: () => void;
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const CATEGORY_LABELS: Record<DisputeCategory, string> = {
  pricing: 'Pricing issue',
  non_compliance: 'Non-compliance',
  settlement_error: 'Settlement error',
  other: 'Other',
};

function mapDisputeErrorMessage(status: number, fallback: string) {
  switch (status) {
    case 400:
      return 'Please review your reason and evidence before submitting again.';
    case 404:
      return 'This commitment could not be found. Please refresh and try again.';
    case 409:
      return 'This commitment already has an active dispute, so no new dispute was created.';
    case 429:
      return 'We are receiving a lot of dispute submissions right now. Please wait a moment and try again.';
    default:
      return fallback;
  }
}

export default function DisputeModal({ isOpen, commitmentId, onClose, onSubmitted }: DisputeModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const { address, connected } = useWallet();
  const [status, setStatus] = useState<DisputeStatus>('idle');
  const [category, setCategory] = useState<DisputeCategory>('other');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setStatus('idle');
    setCategory('other');
    setReason('');
    setEvidence('');
    setErrorMessage('');
    setIsSubmitting(false);

    const focusDialog = () => {
      dialogRef.current?.focus();
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focusDialog);
    } else {
      window.setTimeout(focusDialog, 0);
    }

    return () => {
      previousFocusRef.current?.focus?.();
    };
  }, [isOpen]);

  const handleSubmit = useCallback(async () => {
    if (!connected || !address) {
      setStatus('error');
      setErrorMessage('Connect your wallet before submitting a dispute.');
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length === 0) {
      setStatus('error');
      setErrorMessage('Please provide a reason for the dispute.');
      return;
    }

    if (trimmedReason.length > 500) {
      setStatus('error');
      setErrorMessage('The reason must be 500 characters or fewer.');
      return;
    }

    setStatus('submitting');
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: trimmedReason,
          evidence: evidence.trim() || undefined,
          callerAddress: address,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.message || data.error || 'Unable to submit the dispute right now.';
        setStatus('error');
        setErrorMessage(mapDisputeErrorMessage(response.status, message));
        return;
      }

      setStatus('success');
      onSubmitted?.();
    } catch {
      setStatus('error');
      setErrorMessage('We could not reach the dispute service. Please try again in a moment.');
    } finally {
      setIsSubmitting(false);
    }
  }, [address, category, commitmentId, connected, evidence, onSubmitted, reason]);

  const isDisabled = useMemo(() => isSubmitting || !connected || !address, [address, connected, isSubmitting]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !isSubmitting) {
      onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    if (focusableElements.length === 0) {
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[560px] rounded-[18px] border border-[#FF8A0433] bg-[#0A0A0A] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#FF8A04]/30 bg-[#FF8A04]/10">
              <AlertTriangle className="h-6 w-6 text-[#FF8A04]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#FF8A04]">
                Report an issue
              </p>
              <h2 id={titleId} className="mt-1 text-2xl font-semibold leading-tight">
                Dispute commitment
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dispute modal"
            className="rounded-full border border-white/10 p-2 text-white/70 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p id={descriptionId} className="mt-4 text-sm leading-6 text-white/70">
          Share what is wrong with this commitment and we will review it. The report is sent to the dispute route with your connected wallet address.
        </p>

        {!connected || !address ? (
          <div className="mt-4 rounded-[14px] border border-[#F9737333] bg-[#F9737312] px-4 py-3 text-sm text-[#FECACA]">
            Connect your wallet before submitting a dispute.
          </div>
        ) : null}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="dispute-category" className="mb-2 block text-sm font-medium text-white/80">
              Dispute category
            </label>
            <select
              id="dispute-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as DisputeCategory)}
              disabled={isSubmitting}
              className="w-full rounded-[14px] border border-white/10 bg-[#050505] px-4 py-3 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="dispute-reason" className="mb-2 block text-sm font-medium text-white/80">
              Reason for dispute
            </label>
            <textarea
              id="dispute-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isSubmitting}
              rows={4}
              placeholder="Describe the issue with this commitment..."
              className="w-full resize-none rounded-[14px] border border-white/10 bg-[#050505] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A04] disabled:cursor-not-allowed disabled:opacity-50"
              autoComplete="off"
            />
            <p className="mt-2 text-[12px] text-white/40">The reason must be at least 1 character and at most 500 characters.</p>
          </div>

          <div>
            <label htmlFor="dispute-evidence" className="mb-2 block text-sm font-medium text-white/80">
              Evidence or notes
            </label>
            <textarea
              id="dispute-evidence"
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              disabled={isSubmitting}
              rows={3}
              placeholder="Optional supporting details..."
              className="w-full resize-none rounded-[14px] border border-white/10 bg-[#050505] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A04] disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
        </div>

        {status === 'success' ? (
          <div role="status" className="mt-5 flex gap-3 rounded-[14px] border border-[#22C55E33] bg-[#22C55E12] px-4 py-3 text-sm leading-6 text-[#BBF7D0]">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <span>Dispute submitted. The commitment is now under review.</span>
          </div>
        ) : errorMessage ? (
          <div role="alert" className="mt-5 flex gap-3 rounded-[14px] border border-[#F9737333] bg-[#F9737312] px-4 py-3 text-sm leading-6 text-[#FECACA]">
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[14px] border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'success' ? 'Close' : 'Cancel'}
          </button>
          {status !== 'success' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#FF8A0466] bg-[#FF8A041A] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(255,138,4,0.22)] transition-all hover:bg-[#FF8A0426] hover:shadow-[0_0_24px_rgba(255,138,4,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A04] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <AlertTriangle size={18} />}
              {isSubmitting ? 'Submitting dispute' : 'Submit dispute'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
