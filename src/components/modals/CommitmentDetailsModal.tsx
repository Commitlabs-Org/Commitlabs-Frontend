"use client";

import React, { useRef } from "react";
import Link from "next/link";
import { X, Calendar, Activity, AlertTriangle, DollarSign } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";

type CommitmentTypeVariant = "safe" | "balanced" | "aggressive";
type CommitmentTypeCapitalized = "Safe" | "Balanced" | "Aggressive";
type ComplianceStatusVariant = "ok" | "warning" | "error";

interface ComplianceItem {
  id: string;
  label: string;
  statusLabel: string;
  statusVariant?: ComplianceStatusVariant;
}

interface CommitmentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  commitmentId: string;
  typeLabel: string;
  typeVariant: CommitmentTypeVariant;
  statusLabel?: string;
  currentPrice: string;
  amountCommitted: string;
  remainingDuration: string;
  currentYield: string;
  maxLoss: string;
  complianceItems: ComplianceItem[];
  onSelectComplianceItem?: (id: string) => void;
  TypeIcon: React.ComponentType<{ type: "Safe" | "Balanced" | "Aggressive" }>;
  reputationScore?: number;
  totalCommitments?: number;
  successRate?: number;
}

function capitalizeType(
  type: CommitmentTypeVariant,
): CommitmentTypeCapitalized {
  return (type.charAt(0).toUpperCase() +
    type.slice(1)) as CommitmentTypeCapitalized;
}

function getStatusColor(variant?: ComplianceStatusVariant) {
  switch (variant) {
    case "ok":
      return "text-[#00C950]";
    case "warning":
      return "text-[#FF8904]";
    case "error":
      return "text-[#FF0000]";
    default:
      return "text-[#00C950]";
  }
}

function getStatusIcon(variant?: ComplianceStatusVariant) {
  const color = getStatusColor(variant);
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={color}
    >
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 8L7 10L11 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CommitmentDetailsModal({
  isOpen,
  onClose,
  commitmentId,
  typeLabel,
  typeVariant,
  statusLabel,
  currentPrice,
  amountCommitted,
  remainingDuration,
  currentYield,
  maxLoss,
  complianceItems,
  onSelectComplianceItem,
  TypeIcon,
}: CommitmentDetailsModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const firstComplianceItem = complianceItems?.[0];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      labelledById="modal-title"
      className="w-full max-h-[100dvh] sm:max-h-[90vh] sm:max-w-[640px] overflow-y-auto bg-[#0A0A0A] sm:border border-[#FFFFFF1A] sm:rounded-[32px] flex flex-col relative shadow-2xl"
    >
      <div className="sticky top-0 z-10 bg-[#0A0A0A]/90 backdrop-blur-md px-6 sm:px-10 py-6 flex items-start justify-between border-b border-[#FFFFFF0D] sm:border-none">
        <div className="flex items-center gap-5">
          <div className="w-[52px] h-[52px] sm:w-[64px] sm:h-[64px] rounded-[18px] bg-gradient-to-b from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner">
            <TypeIcon type={capitalizeType(typeVariant)} />
          </div>
          <div>
            <h2
              id="modal-title"
              className="text-[20px] sm:text-[28px] font-bold tracking-tight text-white leading-tight"
            >
              {typeLabel}
            </h2>
            {statusLabel && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#0FF0FC] animate-pulse" />
                <span className="text-[13px] font-medium text-[#0FF0FC]/90 uppercase tracking-wider">
                  {statusLabel}
                </span>
              </div>
            )}
          </div>
        </div>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="focus-ring w-10 h-10 rounded-full bg-[#FFFFFF0D] hover:bg-[#FFFFFF1A] flex items-center justify-center transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 text-white/50" />
        </button>
      </div>

      <div className="px-6 sm:px-10 pb-10">
        <div className="grid gap-6">
          <section className="grid gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#0FF0FC]/80 font-semibold">
                  Quick view
                </p>
                <p className="text-[15px] sm:text-[16px] text-white/70 max-w-2xl">
                  Prioritizing risk, status, value, and key commitment
                  parameters in a compact quick-view.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/80">
                <span className="uppercase tracking-[0.3em] text-[#0FF0FC]/80">
                  Risk
                </span>
                <div className="flex items-center gap-2 text-white font-mono text-[13px]">
                  {firstComplianceItem ? (
                    <>
                      {getStatusIcon(firstComplianceItem.statusVariant)}
                      {firstComplianceItem.statusLabel}
                    </>
                  ) : (
                    "N/A"
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#0FF0FC0D] to-transparent border border-[#0FF0FC1A] rounded-[24px] p-6 sm:p-8">
              <div className="text-[#9CA3AF] text-[13px] font-medium uppercase tracking-[0.25em] mb-3">
                Current market value
              </div>
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-[36px] sm:text-[44px] font-bold text-white leading-none">
                  {currentPrice}
                </div>
                <div className="text-[14px] font-mono text-[#0FF0FC] font-semibold">
                  USD
                </div>
              </div>
              <p className="mt-4 text-[14px] leading-6 text-white/70">
                This quick-view surfaces essential commitment details first,
                while offering a clear path to the full details page.
              </p>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] rounded-[20px] p-5 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <DollarSign className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Committed value
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {amountCommitted}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-5 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Remaining term
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {remainingDuration}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-5 border border-white/[0.08]">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <Activity className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Expected yield
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-[#0FF0FC] leading-none">
                {currentYield}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-5 border border-white/[0.08] text-right sm:text-left">
              <div className="flex items-center justify-end sm:justify-start gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF8904]" />
                Max loss
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {maxLoss}
              </div>
            </div>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-bold text-white/90 uppercase tracking-widest">
                Compliance & attestations
              </h3>
              <span className="text-[13px] text-white/50 uppercase tracking-[0.24em]">
                {complianceItems.length} checks
              </span>
            </div>

            <div className="space-y-3">
              {complianceItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSelectComplianceItem?.(item.id)}
                  className={`focus-ring w-full flex items-center justify-between bg-[#FFFFFF03] rounded-[12px] p-4 border border-[#FFFFFF08] transition-colors ${
                    onSelectComplianceItem
                      ? "hover:bg-[#FFFFFF08] cursor-pointer"
                      : "cursor-default"
                  }`}
                  disabled={!onSelectComplianceItem}
                  aria-label={`${item.label}: ${item.statusLabel}`}
                >
                  <span className="text-[#9CA3AF] text-[14px]">
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 text-white font-mono text-[13px]">
                    {getStatusIcon(item.statusVariant)}
                    {item.statusLabel}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/commitments/${commitmentId}`}
            className="focus-ring inline-flex items-center justify-center rounded-2xl border border-[#0FF0FC33] bg-[#0FF0FC0D] px-5 py-4 text-[15px] font-semibold text-[#0FF0FC] transition hover:bg-[#0FF0FC14]"
          >
            View full details
          </Link>
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 px-6 text-[16px] font-bold text-white transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </Dialog>
  );
}
