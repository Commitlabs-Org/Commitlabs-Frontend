'use client';

import React from 'react';
import { Download, X } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  onExportSelected?: () => void;
  isExporting?: boolean;
}

/**
 * BulkActionBar
 *
 * Floats at the bottom of the grid when one or more items are selected.
 * Hidden (aria-hidden) when nothing is selected so it doesn't pollute
 * the accessibility tree during normal browsing.
 */
export function BulkActionBar({
  selectedCount,
  onClear,
  onExportSelected,
  isExporting = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-white/15 bg-[#0d0d0d]/90 backdrop-blur-md px-5 py-3 shadow-lg shadow-black/40"
    >
      <span className="text-[13px] text-[#94A3B8]">
        <span className="font-semibold text-white">{selectedCount}</span>{' '}
        {selectedCount === 1 ? 'item' : 'items'} selected
      </span>

      {onExportSelected && (
        <button
          onClick={onExportSelected}
          disabled={isExporting}
          aria-label="Export selected commitments"
          className="flex items-center gap-1.5 rounded-lg bg-[#0FF0FC]/10 border border-[#0FF0FC]/30 px-3 py-1.5 text-[12px] font-medium text-[#0FF0FC] hover:bg-[#0FF0FC]/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          <Download size={13} aria-hidden="true" />
          {isExporting ? 'Exporting…' : 'Export'}
        </button>
      )}

      <button
        onClick={onClear}
        aria-label="Clear selection"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[12px] font-medium text-[#94A3B8] hover:text-white hover:border-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <X size={13} aria-hidden="true" />
        Clear
      </button>
    </div>
  );
}
