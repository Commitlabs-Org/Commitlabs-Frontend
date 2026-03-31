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

  // Focus trap implementation
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    // Focus first element (close button)
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

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
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => modal.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-fadeIn"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby="modal-description"
    >
      <div
        ref={modalRef}
        className="w-full max-w-[600px] max-h-[90vh] overflow-y-auto hide-scrollbar bg-[#0A0A0A] border border-[#FFFFFF1A] rounded-[24px] p-6 text-white relative shadow-2xl animate-scaleIn"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-[60px] h-[60px] rounded-[18px] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0)_100%)] border border-[#FFFFFF1A] grid place-items-center">
              <TypeIcon type={capitalizeType(typeVariant)} />
            </div>
            <div>
              <h2
                id="modal-title"
                className="text-[24px] font-bold leading-tight"
              >
                {typeLabel}
              </h2>
              {statusLabel && (
                <span className="inline-block mt-2 text-[12px] font-semibold px-3 py-1.5 rounded-full bg-[#0FF0FC1A] text-[#0FF0FC] border border-[#0FF0FC33]">
                  {statusLabel}
                </span>
              )}
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="focus-ring w-10 h-10 rounded-full bg-[#FFFFFF0D] hover:bg-[#FFFFFF1A] flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        {/* Current Price Card */}
        <div
          id="modal-description"
          className="bg-[#0FF0FC08] border border-[#0FF0FC1A] rounded-[20px] p-6 mb-6"
        >
          <div className="text-[#9CA3AF] text-[14px] font-medium mb-1">
            Current Price
          </div>
          <div className="text-[32px] font-bold text-white tracking-tight">
            {currentPrice}
          </div>
        </div>

        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {/* Amount Committed */}
          <div className="bg-[#FFFFFF05] rounded-[16px] p-5 border border-[#FFFFFF0D]">
            <div className="flex items-center gap-2 mb-3 text-[#9CA3AF] text-[14px]">
              <DollarSign className="w-3.5 h-3.5 text-[#0FF0FC]" />
              Amount Committed
            </div>
            <div className="text-[20px] font-bold tracking-tight">
              {amountCommitted}
            </div>
          </div>

          {/* Remaining Duration */}
          <div className="bg-[#FFFFFF05] rounded-[16px] p-5 border border-[#FFFFFF0D]">
            <div className="flex items-center gap-2 mb-3 text-[#9CA3AF] text-[14px]">
              <Calendar className="w-3.5 h-3.5 text-[#0FF0FC]" />
              Remaining Duration
            </div>
            <div className="text-[20px] font-bold tracking-tight">
              {remainingDuration}
            </div>
          </div>

          {/* Current Yield */}
          <div className="bg-[#FFFFFF05] rounded-[16px] p-5 border border-[#FFFFFF0D]">
            <div className="flex items-center gap-2 mb-3 text-[#9CA3AF] text-[14px]">
              <Activity className="w-3.5 h-3.5 text-[#0FF0FC]" />
              Current Yield
            </div>
            <div className="text-[20px] font-bold tracking-tight text-[#0FF0FC]">
              {currentYield}
            </div>
          </div>

          {/* Max Loss */}
          <div className="bg-[#FFFFFF05] rounded-[16px] p-5 border border-[#FFFFFF0D]">
            <div className="flex items-center gap-2 mb-3 text-[#9CA3AF] text-[14px]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#0FF0FC]" />
              Max Loss
            </div>
            <div className="text-[20px] font-bold tracking-tight">
              {maxLoss}
            </div>
          </div>
        </div>

        {/* Compliance & Attestations */}
        <div>
          <h3 className="text-[16px] font-bold mb-4">
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
    </div>,
    document.body
  );
}
