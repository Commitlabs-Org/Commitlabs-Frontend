'use client';

import React, { useRef, useState } from 'react';
import { ArrowRight, CheckCircle, Copy, ExternalLink, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

export interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  commitmentId: string;
  commitmentType: string;
  pricePaid: string;
  txHash?: string;
  onViewCommitments: () => void;
}

function truncateHash(hash: string) {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
}

export default function PurchaseSuccessModal({
  isOpen,
  onClose,
  commitmentId,
  commitmentType,
  pricePaid,
  txHash,
  onViewCommitments,
}: PurchaseSuccessModalProps) {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  function handleCopyHash() {
    if (!txHash) return;
    navigator.clipboard.writeText(txHash).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const explorerUrl = txHash
    ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
    : null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={primaryButtonRef}
      labelledById="purchase-success-title"
      describedById="purchase-success-description"
      className="relative flex max-h-[100dvh] w-full max-w-[540px] flex-col overflow-y-auto rounded-[32px] border border-white/10 bg-[#0A0A0A] shadow-2xl sm:max-h-[90vh]"
    >
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
              <CheckCircle className="h-10 w-10 text-[#0FF0FC] sm:h-12 sm:w-12" strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center">
            <h2
              id="purchase-success-title"
              className="mb-2 text-[28px] font-bold leading-tight tracking-tight text-white sm:text-[32px]"
            >
              Purchase Successful
            </h2>
            <p
              id="purchase-success-description"
              className="mx-auto max-w-[340px] text-[15px] font-medium leading-relaxed text-white/50 sm:text-[16px]"
            >
              You now own this commitment. It has been transferred to your wallet.
            </p>
          </div>
        </div>

        {/* Ownership summary */}
        <div className="group relative mb-6 overflow-hidden rounded-[24px] border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:bg-white/[0.05]">
          <div className="absolute -mr-12 -mt-12 right-0 top-0 h-24 w-24 rounded-full bg-[#0FF0FC] opacity-[0.02] blur-2xl transition-opacity group-hover:opacity-[0.04]" />
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">
                Commitment
              </dt>
              <dd className="m-0 font-mono text-[14px] font-bold tracking-wider text-[#0FF0FC]">
                #CMT-{commitmentId.padStart(3, '0')}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">
                Type
              </dt>
              <dd className="m-0 text-[14px] font-semibold text-white/90">
                {commitmentType}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-[13px] font-bold uppercase tracking-[0.15em] text-white/40">
                Price Paid
              </dt>
              <dd className="m-0 text-[20px] font-bold text-white">
                {pricePaid}
              </dd>
            </div>
          </dl>
        </div>

        {/* Transaction hash */}
        {txHash ? (
          <div className="mb-8 rounded-[16px] border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.15em] text-white/40">
              Transaction Hash
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 truncate font-mono text-[13px] text-white/70">
                {truncateHash(txHash)}
              </span>
              <button
                type="button"
                onClick={handleCopyHash}
                aria-label="Copy transaction hash"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 transition-all hover:bg-white/10 active:scale-95"
              >
                <Copy className="h-3.5 w-3.5 text-white/50" />
              </button>
            </div>
            {copied && (
              <p role="status" className="mt-1.5 text-[12px] text-[#0FF0FC]">
                Copied!
              </p>
            )}
          </div>
        ) : (
          <div className="mb-8 rounded-[16px] border border-white/[0.06] bg-white/[0.02] p-4 text-[13px] text-white/30">
            Transaction hash unavailable.
          </div>
        )}

        {/* CTAs */}
        <div className="space-y-3">
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={onViewCommitments}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#0FF0FC] py-4 text-[16px] font-bold text-black transition-all shadow-[0_0_30px_rgba(15,240,252,0.3)] hover:scale-[1.01] hover:bg-[#0FF0FC]/90 active:scale-[0.98]"
          >
            View in My Commitments
            <ArrowRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3.5 text-[14px] font-bold text-white transition-all hover:bg-white/10 active:scale-[0.98]"
          >
            Close
          </button>
        </div>

        {/* Explorer link */}
        {explorerUrl && (
          <div className="mt-8 border-t border-white/5 pt-6">
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 py-1 text-[13px] text-white/30 transition-colors hover:text-[#0FF0FC]"
            >
              View on Stellar Explorer
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </Dialog>
  );
}
