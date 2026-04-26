"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Activity, AlertTriangle, DollarSign } from "lucide-react";

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
}

function capitalizeType(type: CommitmentTypeVariant): CommitmentTypeCapitalized {
  return (type.charAt(0).toUpperCase() + type.slice(1)) as CommitmentTypeCapitalized;
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
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Keyboard and Body Scroll handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      
      // Focus trap
      if (e.key === "Tab" && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement?.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement?.focus();
            e.preventDefault();
          }
        }
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-h-[100dvh] sm:max-h-[90vh] sm:max-w-[640px] overflow-y-auto bg-[#0A0A0A] sm:border border-[#FFFFFF1A] sm:rounded-[32px] flex flex-col relative shadow-2xl animate-in slide-in-from-bottom-8 duration-500 ease-out"
      >
        {/* Header - Sticky on mobile */}
        <div className="sticky top-0 z-10 bg-[#0A0A0A]/80 backdrop-blur-md px-6 sm:px-10 py-6 flex items-start justify-between border-b border-[#FFFFFF0D] sm:border-none">
          <div className="flex items-center gap-5">
            <div className="w-[52px] h-[52px] sm:w-[64px] sm:h-[64px] rounded-[18px] bg-gradient-to-b from-white/10 to-transparent border border-white/10 flex items-center justify-center shadow-inner">
              <TypeIcon type={capitalizeType(typeVariant)} />
            </div>
            <div>
              <h2 id="modal-title" className="text-[20px] sm:text-[28px] font-bold tracking-tight text-white leading-tight">
                {typeLabel}
              </h2>
              {statusLabel && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#0FF0FC] animate-pulse" />
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

        {/* Content */}
        <div className="px-6 sm:px-10 pb-10">
          {/* Main Hero Metric */}
          <div className="bg-gradient-to-br from-[#0FF0FC0D] to-transparent border border-[#0FF0FC1A] rounded-[24px] p-6 sm:p-8 mb-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0FF0FC] opacity-[0.03] blur-3xl rounded-full -mr-16 -mt-16 group-hover:opacity-[0.05] transition-opacity" />
            <div className="text-[#9CA3AF] text-[14px] font-medium mb-1.5">
              Current Market Price
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-[36px] sm:text-[44px] font-bold text-white tracking-tighter leading-none">
                {currentPrice}
              </div>
              <div className="text-[14px] font-mono text-[#0FF0FC] font-semibold">USD</div>
            </div>
          </div>

          {/* Stats Group - Consistency with metadata blocks */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-8">
            <div className="bg-white/[0.03] rounded-[20px] p-4 sm:p-5 border border-white/[0.08] hover:bg-white/[0.05] transition-colors">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <DollarSign className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Committed
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {amountCommitted}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-4 sm:p-5 border border-white/[0.08] hover:bg-white/[0.05] transition-colors">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <Calendar className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Remaining
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {remainingDuration}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-4 sm:p-5 border border-white/[0.08] hover:bg-white/[0.05] transition-colors">
              <div className="flex items-center gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <Activity className="w-3.5 h-3.5 text-[#0FF0FC]" />
                Yield
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-[#0FF0FC] leading-none">
                {currentYield}
              </div>
            </div>

            <div className="bg-white/[0.03] rounded-[20px] p-4 sm:p-5 border border-white/[0.08] hover:bg-white/[0.05] transition-colors text-right sm:text-left">
              <div className="flex items-center justify-end sm:justify-start gap-2 mb-3 text-white/40 text-[13px] font-medium">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF8904]" />
                Max Loss
              </div>
              <div className="text-[18px] sm:text-[22px] font-bold text-white leading-none">
                {maxLoss}
              </div>
            </div>
          </div>

          {/* Compliance Section */}
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold text-white/90 uppercase tracking-widest ml-1">
              Compliance & Attestations
            </h3>

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
          </div>
          </div>
        </div>
        </div>
        
        {/* Footer Actions - Standardized Bottom Placement */}
        <div className="px-6 sm:px-10 pb-10 mt-auto">
          <button
            onClick={onClose}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl py-4 text-[16px] font-bold text-white transition-all active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
