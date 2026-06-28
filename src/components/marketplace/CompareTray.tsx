'use client';

import { useEffect, useRef, useState } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';
import { MAX_COMPARE_LISTINGS } from '@/hooks/useCompareListings';
import { CompareView } from './CompareView';

interface CompareTrayProps {
  listings: MarketplaceCardProps[];
  onRemove: (id: string) => void;
  onClear: () => void;
  openOnRestore?: boolean;
}

export function CompareTray({
  listings,
  onRemove,
  onClear,
  openOnRestore = false,
}: CompareTrayProps) {
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!openOnRestore) {
      hasAutoOpenedRef.current = false;
      return;
    }

    if (hasAutoOpenedRef.current || listings.length < 2) return;

    setIsCompareOpen(true);
    hasAutoOpenedRef.current = true;
  }, [listings.length, openOnRestore]);

  if (listings.length === 0) {
    return null;
  }

  return (
    <>
      <div
        role="region"
        aria-label="Compare listings tray"
        className="fixed bottom-0 inset-x-0 z-50 border-t border-[#0FF0FC]/30 bg-[#0A0A0A]/95 backdrop-blur-md px-4 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.55)]"
      >
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-white">
              {listings.length} of {MAX_COMPARE_LISTINGS} selected for compare
            </span>
            <ul className="flex flex-wrap gap-2 list-none p-0 m-0" aria-label="Pinned listings">
              {listings.map((listing) => (
                <li key={listing.id}>
                  <button
                    type="button"
                    className="focus-ring inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-mono text-white/80 hover:bg-white/10"
                    onClick={() => onRemove(listing.id)}
                    aria-label={`Remove #CMT-${listing.id.padStart(3, '0')} from compare`}
                  >
                    #CMT-{listing.id.padStart(3, '0')}
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="focus-ring rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5"
              onClick={onClear}
              aria-label="Clear all pinned listings"
            >
              Clear
            </button>
            <button
              type="button"
              className="focus-ring rounded-xl border border-[#0FF0FC]/40 bg-[#0FF0FC]/15 px-5 py-2.5 text-sm font-bold text-[#0FF0FC] hover:bg-[#0FF0FC]/25 disabled:opacity-50"
              onClick={() => setIsCompareOpen(true)}
              disabled={listings.length < 2}
              aria-label="Open side-by-side comparison"
            >
              Compare
            </button>
            <button
              type="button"
              className="focus-ring rounded-xl border border-white/15 px-3 py-2.5 text-sm text-white/60 hover:bg-white/5"
              onClick={onClear}
              aria-label="Dismiss compare tray"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      <CompareView
        listings={listings}
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        onRemove={onRemove}
      />
    </>
  );
}
