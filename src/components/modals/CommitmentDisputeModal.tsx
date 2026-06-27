'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

type DisputeStatus = 'idle' | 'submitting' | 'success' | 'error';

interface CommitmentDisputeModalProps {
  isOpen: boolean;
  commitmentId: string;
  onClose: () => void;
}

const focusableSelector = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function CommitmentDisputeModal({
  isOpen,
  commitmentId,
  onClose,
}: CommitmentDisputeModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<DisputeStatus>('idle');
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setStatus('idle');
    setReason('');
    setErrorMessage('');

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
    if (!reason.trim()) {
      setStatus('error');
      setErrorMessage('Please provide a reason for the dispute.');
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/commitments/${encodeURIComponent(commitmentId)}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setStatus('error');
        setErrorMessage(data.message || data.error || 'Failed to submit dispute. Try again.');
        return;
      }

      setStatus('success');
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Check your connection and try again.');
    }
  }, [commitmentId, reason]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && status !== 'submitting') {
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(focusableSelector)
    );

    if (focusableElements.length === 0) return;

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

  if (!isOpen) return null;

  const isSubmitting = status === 'submitting';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[520px] rounded-[18px] border border-[#FF8A0433] bg-[#0A0A0A] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
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
          Submit a formal dispute for commitment <span className="font-mono text-[#0FF0FC]">{commitmentId}</span>.
          This action will be recorded on-chain.
        </p>

        <div className="mt-6">
          <label htmlFor="dispute-reason" className="block text-sm font-medium text-white/80 mb-2">
            Reason for dispute
          </label>
          <textarea
            id="dispute-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            rows={4}
            placeholder="Describe the issue with this commitment..."
            className="w-full rounded-[14px] border border-white/10 bg-[#050505] px-4 py-3 text-white placeholder:text-white/30 resize-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8A04] disabled:cursor-not-allowed disabled:opacity-50"
            autoComplete="off"
          />
          <p className="mt-2 text-[12px] text-white/40">
            The reason must be at least 1 character and at most 500 characters.
          </p>
        </div>

        {status === 'success' ? (
          <div
            role="status"
            className="mt-5 flex gap-3 rounded-[14px] border border-[#22C55E33] bg-[#22C55E12] px-4 py-3 text-sm leading-6 text-[#BBF7D0]"
          >
            <AlertTriangle className="mt-0.5 shrink-0" size={18} />
            <span>Dispute submitted. The commitment is now under review.</span>
          </div>
        ) : errorMessage ? (
          <div
            role="alert"
            className="mt-5 flex gap-3 rounded-[14px] border border-[#F9737333] bg-[#F9737312] px-4 py-3 text-sm leading-6 text-[#FECACA]"
          >
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
              disabled={isSubmitting || !reason.trim()}
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
