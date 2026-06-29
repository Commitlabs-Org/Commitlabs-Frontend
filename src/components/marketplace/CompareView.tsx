'use client';

import { useEffect, useRef } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';
import { TrustBadge } from '@/components/TrustBadge';

interface CompareViewProps {
  listings: MarketplaceCardProps[];
  isOpen: boolean;
  onClose: () => void;
  onRemove: (id: string) => void;
}

const COMPARE_FIELDS: Array<{
  label: string;
  getValue: (listing: MarketplaceCardProps) => string;
}> = [
  { label: 'Type', getValue: (l) => l.type },
  { label: 'Compliance', getValue: (l) => `${l.score}%` },
  { label: 'Amount', getValue: (l) => l.amount },
  { label: 'Duration', getValue: (l) => l.duration },
  { label: 'Yield (APY)', getValue: (l) => l.yield },
  { label: 'Max Loss', getValue: (l) => l.maxLoss },
  { label: 'Price', getValue: (l) => (l.forSale ? l.price : 'Not for sale') },
  {
    label: 'Seller',
    getValue: (l) => {
      const addr = l.owner?.trim() ?? '';
      if (addr.length <= 12) return addr;
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    },
  },
];

function truncateAddress(addr: string) {
  const s = addr?.trim() ?? '';
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
}

export function CompareView({ listings, isOpen, onClose, onRemove }: CompareViewProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compare-view-title"
        className="w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0A0A0A] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0A0A0A] px-6 py-4">
          <h2 id="compare-view-title" className="text-xl font-semibold text-white">
            Compare Listings
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="focus-ring rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/5"
            onClick={onClose}
            aria-label="Close comparison view"
          >
            Close
          </button>
        </header>

        <div className="overflow-x-auto p-6">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              Side-by-side comparison of {listings.length} marketplace listings
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[140px] pb-4 pr-4 text-sm font-medium text-white/50">
                  Metric
                </th>
                {listings.map((listing) => (
                  <th
                    key={listing.id}
                    scope="col"
                    className="pb-4 px-4 text-sm font-semibold text-white align-top min-w-[180px]"
                  >
                    <div className="flex flex-col gap-2">
                      <span className="font-mono text-[#0FF0FC]">
                        #CMT-{listing.id.padStart(3, '0')}
                      </span>
                      <div className="flex items-center gap-2">
                        <TrustBadge level={listing.trustLevel ?? 'unverified'} showTooltip={false} />
                        <button
                          type="button"
                          className="focus-ring ml-auto rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:bg-white/5"
                          onClick={() => onRemove(listing.id)}
                          aria-label={`Remove listing ${listing.id} from comparison`}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FIELDS.map((field) => (
                <tr key={field.label} className="border-t border-white/5">
                  <th
                    scope="row"
                    className="py-3 pr-4 text-sm font-medium text-white/50 align-top"
                  >
                    {field.label}
                  </th>
                  {listings.map((listing) => (
                    <td key={`${listing.id}-${field.label}`} className="py-3 px-4 text-sm text-white/90">
                      {field.label === 'Seller' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-mono">{truncateAddress(listing.owner)}</span>
                          <TrustBadge level={listing.trustLevel ?? 'unverified'} showTooltip={false} />
                        </span>
                      ) : field.label === 'Yield (APY)' ? (
                        <span className="font-semibold text-[#0FF0FC]">{field.getValue(listing)}</span>
                      ) : (
                        field.getValue(listing)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
