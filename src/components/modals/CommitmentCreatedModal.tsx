'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, ExternalLink, Eye, X } from 'lucide-react';
import Dialog from '@/components/ui/Dialog';

export interface CommitmentCreatedModalProps {
  isOpen: boolean;
  commitmentId: string;
  onViewCommitment: () => void;
  onCreateAnother: () => void;
  onClose: () => void;
  onViewOnExplorer?: () => void;
}

const nextSteps = [
  'Your commitment is now active and earning yield',
  'Monitor compliance and performance in your dashboard',
  'You can trade this commitment NFT in the marketplace',
];

export default function CommitmentCreatedModal({
  isOpen,
  commitmentId,
  onViewCommitment,
  onCreateAnother,
  onClose,
  onViewOnExplorer,
}: CommitmentCreatedModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Commitment Created"
      description="Your liquidity commitment is active and available in your dashboard."
      initialFocusRef={primaryButtonRef}
      panelClassName="relative flex max-h-[100dvh] w-full max-w-[540px] flex-col overflow-y-auto rounded-[32px] border border-white/10 bg-[#0A0A0A] shadow-2xl motion-safe:animate-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-500 motion-safe:ease-out sm:max-h-[90vh]"
      closeButtonClassName="absolute right-6 top-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-all hover:scale-105 hover:bg-white/10 active:scale-95"
      closeIcon={<X className="h-5 w-5 text-white/50" />}
      closeLabel="Close Commitment Created dialog"
    >
        <div className="flex-1 px-6 pb-10 pt-12 sm:px-10">
          <div className="mb-8 flex flex-col items-center">
            <div className="relative mb-6 h-20 w-20 sm:h-24 sm:w-24">
              <div className="absolute inset-0 rounded-full bg-[#0FF0FC] opacity-20 blur-2xl motion-safe:animate-pulse" />
              <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full border-2 border-[#0FF0FC] bg-[#0FF0FC]/10 shadow-[inset_0_0_20px_rgba(15,240,252,0.2)]">
                <CheckCircle className="h-10 w-10 text-[#0FF0FC] sm:h-12 sm:w-12" strokeWidth={2.5} />
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
                Your liquidity commitment is active and available in your dashboard.
              </p>
            </div>
          </div>

          <div className="group relative mb-8 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 text-center transition-colors hover:bg-white/[0.05]">
            <div className="absolute -mr-12 -mt-12 right-0 top-0 h-24 w-24 rounded-full bg-[#0FF0FC] opacity-[0.02] blur-2xl transition-opacity group-hover:opacity-[0.04]" />
            <div className="mb-3 ml-1 text-[13px] font-bold uppercase tracking-[0.2em] text-white/40">
              Commitment ID
            </div>
            <div className="break-all rounded-xl border border-white/5 bg-white/5 px-4 py-3 font-mono text-[14px] font-bold tracking-wider text-[#0FF0FC] sm:text-[16px]">
              {commitmentId}
            </div>
          </div>

          <div className="mb-10 lg:px-2">
            <h3 className="mb-5 ml-1 text-[14px] font-bold uppercase tracking-widest text-white/90">
              Next Steps
            </h3>
            <div className="space-y-4">
              {nextSteps.map((step) => (
                <div key={step} className="flex items-start gap-4 p-1">
                  <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#0FF0FC]/30 bg-[#0FF0FC]/10">
                    <CheckCircle className="h-3 w-3 text-[#0FF0FC]" strokeWidth={3} />
                  </div>
                  <span className="text-[14px] font-medium leading-relaxed text-white/70 sm:text-[15px]">
                    {step}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <button
              ref={primaryButtonRef}
              type="button"
              onClick={onViewCommitment}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0FF0FC] py-4 text-[16px] font-bold text-black transition-all shadow-[0_0_30px_rgba(15,240,252,0.3)] hover:scale-[1.01] hover:bg-[#0FF0FC]/90 active:scale-[0.98]"
            >
              <Eye className="h-5 w-5" />
              View Commitment
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onCreateAnother}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
              >
                <span className="opacity-70">Create Another</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
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
              >
                View on Stellar Explorer
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
    </Dialog>
  );
}
