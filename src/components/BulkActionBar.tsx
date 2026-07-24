'use client';

import React from 'react';
import { Download, X } from 'lucide-react';

interface BulkActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Callback to clear all selections */
  onClear: () => void;
  /** Callback to export selected items */
  onExportSelected: () => void;
  /** Optional label for the export action */
  exportLabel?: string;
  /** Whether the export action is loading */
  isExporting?: boolean;
}

/**
 * Bulk action bar that appears when items are selected in a grid.
 * Shows selection count and provides bulk actions like export.
 * 
 * Accessibility:
 * - Uses role="status" for live region announcements
 * - Proper ARIA labels on all interactive elements
 * - Keyboard accessible buttons
 */
export function BulkActionBar({
  selectedCount,
  onClear,
  onExportSelected,
  exportLabel = 'Export selected',
  isExporting = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up"
    >
      <div className="flex items-center gap-4 rounded-xl border border-[#0FF0FC]/30 bg-[#0a0a0a] px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        {/* Selection count */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">
            {selectedCount} commitment{selectedCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-white/10" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onExportSelected}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-lg border border-[#0FF0FC]/20 bg-[#0FF0FC]/10 px-4 py-2 text-sm font-medium text-[#0FF0FC] transition-all hover:bg-[#0FF0FC]/20 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
            aria-label={`Export ${selectedCount} selected commitment${selectedCount !== 1 ? 's' : ''}`}
          >
            <Download size={16} />
            <span>{isExporting ? 'Exporting...' : exportLabel}</span>
          </button>

          <button
            onClick={onClear}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition-all hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
            aria-label="Clear selection"
          >
            <X size={16} />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
}
