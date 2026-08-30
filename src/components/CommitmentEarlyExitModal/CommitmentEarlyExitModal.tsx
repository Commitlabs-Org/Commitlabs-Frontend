'use client';

import React from 'react';

interface CommitmentEarlyExitModalProps {
  isOpen: boolean;
  commitmentId: string;
  originalAmount: string;
  penaltyPercent: string;
  penaltyAmount: string;
  netReceiveAmount: string;
  hasAcknowledged: boolean;
  onChangeAcknowledged: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CommitmentEarlyExitModal({
  isOpen,
  commitmentId,
  originalAmount,
  penaltyPercent,
  penaltyAmount,
  netReceiveAmount,
  hasAcknowledged,
  onChangeAcknowledged,
  onCancel,
  onConfirm,
}: CommitmentEarlyExitModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Early exit confirmation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-[#0a0a0a] rounded-2xl p-8 border border-[#F97316]/30 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[#F97316] text-lg font-bold mb-4">Early Exit</h2>
        <div className="space-y-2 text-sm text-white/70 mb-6">
          <div className="flex justify-between">
            <span>Original</span>
            <span className="text-white">{originalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span>Penalty ({penaltyPercent})</span>
            <span className="text-[#F97316]">-{penaltyAmount}</span>
          </div>
          <div className="flex justify-between border-t border-[#222] pt-2">
            <span>You receive</span>
            <span className="text-white font-bold">{netReceiveAmount}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 mb-4 text-sm text-white/60 cursor-pointer">
          <input
            type="checkbox"
            checked={hasAcknowledged}
            onChange={onChangeAcknowledged}
            aria-label="I understand the penalty"
          />
          I understand the penalty
        </label>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!hasAcknowledged}
            className="flex-1 py-2 rounded-lg bg-[#F97316] text-white text-sm font-medium disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
