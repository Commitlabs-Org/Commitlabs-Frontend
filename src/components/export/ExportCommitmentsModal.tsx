'use client';

import React from 'react';

interface ExportCommitmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress: string;
}

export default function ExportCommitmentsModal({
  isOpen,
  onClose,
  ownerAddress,
}: ExportCommitmentsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Export commitment data"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#0a0a0a] rounded-2xl p-8 border border-[#222] max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-white text-lg font-bold mb-4">Export Commitment Data</h2>
        <p className="text-white/60 text-sm mb-4">
          Exporting data for address: {ownerAddress.slice(0, 8)}…
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
