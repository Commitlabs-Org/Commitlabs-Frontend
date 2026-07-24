'use client';

import React from 'react';
import Link from 'next/link';
import type { Commitment } from '@/types/commitment';

interface CompareCommitmentsTrayProps {
  selected: Commitment[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const MAX_COMPARE = 3;

export function CompareCommitmentsTray({
  selected,
  onRemove,
  onClear,
}: CompareCommitmentsTrayProps) {
  if (selected.length === 0) return null;

  const compareHref = `/marketplace/compare?ids=${selected.map((c) => c.id).join(',')}`;

  return (
    <div
      role="complementary"
      aria-label="Compare tray"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#222] bg-[#0a0a0a]/95 backdrop-blur px-4 py-3 shadow-2xl"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-[#99a1af] shrink-0">
            Compare ({selected.length}/{MAX_COMPARE}):
          </span>
          {selected.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-lg bg-[#1a1a1a] border border-[#333] px-3 py-1 text-xs text-white"
            >
              #{String(c.id).padStart(3, '0')}
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                aria-label={`Remove commitment #${c.id} from compare`}
                className="text-[#99a1af] hover:text-white focus:outline-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#99a1af] hover:text-white focus:outline-none focus:underline"
          >
            Clear all
          </button>
          <Link
            href={compareHref}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#51A2FF] ${
              selected.length < 2
                ? 'pointer-events-none bg-[#1a1a1a] text-[#555] border border-[#333]'
                : 'bg-[#51A2FF] text-black hover:bg-[#3d8ee8]'
            }`}
            aria-disabled={selected.length < 2}
          >
            Compare {selected.length >= 2 ? `(${selected.length})` : '—'}
          </Link>
        </div>
      </div>
    </div>
  );
}

CompareCommitmentsTray.MAX = MAX_COMPARE;
