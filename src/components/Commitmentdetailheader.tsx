'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, Share2 } from 'lucide-react';
import { buildExplorerUrl, type ExplorerNetwork } from '@/utils/explorerLinks';

interface CommitmentDetailHeaderProps {
  commitmentId: string;
  statusLabel: string;
  statusVariant: 'active' | 'settled' | 'violated' | 'early_exit' | string;
  onBack: () => void;
  onShare: () => void | Promise<unknown>;
  explorerNetwork?: ExplorerNetwork;
}

type CopyStatus = 'idle' | 'copied' | 'unavailable';

const COPY_STATUS_RESET_MS = 2000;

const statusConfig = {
  active: {
    color: 'text-[#0ff0fc]',
    bg: 'bg-[#0ff0fc]/10',
    border: 'border-[#0ff0fc]/20',
    dotColor: 'bg-[#0ff0fc]',
  },
  settled: {
    color: 'text-[#4ade80]',
    bg: 'bg-[#4ade80]/10',
    border: 'border-[#4ade80]/20',
    dotColor: 'bg-[#4ade80]',
  },
  violated: {
    color: 'text-[#ef4444]',
    bg: 'bg-[#ef4444]/10',
    border: 'border-[#ef4444]/20',
    dotColor: 'bg-[#ef4444]',
  },
  early_exit: {
    color: 'text-[#f59e0b]',
    bg: 'bg-[#f59e0b]/10',
    border: 'border-[#f59e0b]/20',
    dotColor: 'bg-[#f59e0b]',
  },
} as const;

export default function CommitmentDetailHeader({
  commitmentId,
  statusLabel,
  statusVariant,
  onBack,
  onShare,
  explorerNetwork = 'public',
}: CommitmentDetailHeaderProps) {
  const config = Object.prototype.hasOwnProperty.call(statusConfig, statusVariant)
    ? statusConfig[statusVariant as keyof typeof statusConfig]
    : statusConfig.active;
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const resetCopyStatusRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement>(null);
  const explorerUrl = useMemo(
    () => buildExplorerUrl('contract', commitmentId, explorerNetwork),
    [commitmentId, explorerNetwork],
  );

  useEffect(
    () => () => {
      if (resetCopyStatusRef.current) {
        clearTimeout(resetCopyStatusRef.current);
      }
    },
    [],
  );

  const showCopyStatus = (status: Exclude<CopyStatus, 'idle'>) => {
    if (resetCopyStatusRef.current) {
      clearTimeout(resetCopyStatusRef.current);
    }

    setCopyStatus(status);
    resetCopyStatusRef.current = setTimeout(() => {
      setCopyStatus('idle');
      resetCopyStatusRef.current = null;
    }, COPY_STATUS_RESET_MS);
  };

  const handleCopyCommitmentId = async () => {
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;

    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(commitmentId);
        showCopyStatus('copied');
        return;
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback for browsers/environments without the Clipboard API
    try {
      const textarea = document.createElement('textarea');
      textarea.value = commitmentId;
      textarea.setAttribute('readonly', '');
      textarea.setAttribute('aria-hidden', 'true');
      textarea.tabIndex = -1;
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      const previousFocus = document.activeElement as HTMLElement | null;
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, commitmentId.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      const copyButton = copyButtonRef.current;
      if (copyButton && document.contains(copyButton)) {
        copyButton.focus();
      } else if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
      if (successful) {
        showCopyStatus('copied');
      } else {
        showCopyStatus('unavailable');
      }
    } catch {
      showCopyStatus('unavailable');
    }
  };

  return (
    <header className="w-full space-y-4 sm:space-y-6">
      {/* Back Navigation */}
      <button
        type="button"
        onClick={onBack}
        className="group flex items-center gap-2 text-sm text-[#666] hover:text-[#0ff0fc] transition-all duration-200 motion-reduce:transition-none focus:outline-none focus:text-[#0ff0fc] focus:drop-shadow-[0_0_8px_rgba(15,240,252,0.4)] focus-visible:ring-2 focus-visible:ring-[#0ff0fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
        aria-label="Go back to My Commitments"
      >
        <ArrowLeft aria-hidden="true" className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform motion-reduce:group-hover:translate-x-0" />
        <span className="group-hover:underline">Back to My Commitments</span>
      </button>

      {/* Main Header Content */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        {/* Left Section: ID and Status */}
        <div className="flex flex-col gap-3">
          {/* Commitment ID */}
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono uppercase tracking-tight text-[#f5f5f7] break-all">
              {commitmentId}
            </h1>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={copyButtonRef}
                onClick={handleCopyCommitmentId}
                className="group inline-flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#222] rounded-full text-[#f5f5f7] text-xs font-medium hover:border-[#0ff0fc]/40 hover:bg-[#0ff0fc]/5 hover:shadow-[0_0_16px_rgba(15,240,252,0.12)] transition-all duration-200 motion-reduce:transition-none focus:outline-none focus:border-[#0ff0fc]/60 focus:shadow-[0_0_20px_rgba(15,240,252,0.22)] focus-visible:ring-2 focus-visible:ring-[#0ff0fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                aria-label="Copy commitment ID"
              >
                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{copyStatus === 'copied' ? 'Copied' : 'Copy ID'}</span>
              </button>

              {explorerUrl ? (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#222] rounded-full text-[#f5f5f7] text-xs font-medium hover:border-[#0ff0fc]/40 hover:bg-[#0ff0fc]/5 hover:shadow-[0_0_16px_rgba(15,240,252,0.12)] transition-all duration-200 motion-reduce:transition-none focus:outline-none focus:border-[#0ff0fc]/60 focus:shadow-[0_0_20px_rgba(15,240,252,0.22)] focus-visible:ring-2 focus-visible:ring-[#0ff0fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]"
                  aria-label="Open commitment in Stellar explorer"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Explorer</span>
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#0a0a0a] border border-[#222] rounded-full text-[#777] text-xs font-medium cursor-not-allowed"
                  aria-label="Explorer link unavailable for this commitment"
                  title="Explorer link unavailable for this commitment"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Explorer unavailable</span>
                </button>
              )}

              <span
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="sr-only"
              >
                {copyStatus === 'idle' ? '' : copyStatus === 'copied' ? 'Copied' : 'Clipboard unavailable'}
              </span>
            </div>
          </div>

          {/* Status Pill */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit ${config.bg} ${config.border} border`}
          >
            <span
              className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse motion-reduce:animate-none`}
              aria-hidden="true"
            />
            <span className={`text-sm font-medium ${config.color}`}>{statusLabel}</span>
          </div>
        </div>

        {/* Right Section: Share Button */}
        <button
          type="button"
          onClick={() => { Promise.resolve().then(onShare).catch(() => {}); }}
          className="group flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0a] border border-[#222] rounded-full text-[#f5f5f7] text-sm font-medium hover:border-[#0ff0fc]/40 hover:bg-[#0ff0fc]/5 hover:shadow-[0_0_20px_rgba(15,240,252,0.15)] hover:-translate-y-0.5 transition-all duration-200 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus:outline-none focus:border-[#0ff0fc]/60 focus:shadow-[0_0_24px_rgba(15,240,252,0.25)] focus-visible:ring-2 focus-visible:ring-[#0ff0fc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505] w-full sm:w-auto justify-center sm:justify-start"
          aria-label="Share commitment"
        >
          <Share2 aria-hidden="true" className="w-4 h-4 group-hover:rotate-6 transition-transform motion-reduce:group-hover:rotate-0 motion-reduce:transition-none" />
          <span>Share</span>
        </button>
      </div>
    </header>
  );
}
