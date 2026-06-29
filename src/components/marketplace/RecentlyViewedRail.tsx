'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { CommitmentDetailsModal } from '../modals/CommitmentDetailsModal';

interface Listing {
  id: string;
  type: 'Safe' | 'Balanced' | 'Aggressive';
  score: number;
  amount: string;
  duration: string;
  yield: string;
  maxLoss: string;
  owner: string;
  price: string;
  forSale: boolean;
  trustLevel?: 'verified' | 'reputable' | 'unverified';
}

interface RecentlyViewedRailProps {
  recentIds: string[];
  listings: Listing[];
  onClear: () => void;
  onViewListing: (id: string) => void;
}

function TypeIcon({ type }: { type: 'Safe' | 'Balanced' | 'Aggressive' }) {
  if (type === 'Safe') {
    return React.createElement(
      'svg',
      { width: '28', height: '28', viewBox: '0 0 28 28', fill: 'none', className: 'w-[22px] h-[22px]' },
      React.createElement('path', {
        d: 'M23.3292 15.164C23.3292 20.9962 19.2466 23.9124 14.3942 25.6037C14.1401 25.6898 13.8641 25.6857 13.6127 25.5921C8.74859 23.9124 4.66602 20.9962 4.66602 15.164V6.99884C4.66602 6.68948 4.78891 6.39279 5.00766 6.17404C5.22641 5.95529 5.5231 5.83239 5.83247 5.83239C8.16536 5.83239 11.0815 4.43265 13.1111 2.65965C13.3582 2.44852 13.6726 2.33252 13.9976 2.33252C14.3226 2.33252 14.637 2.44852 14.8841 2.65965C16.9254 4.44432 19.8299 5.83239 22.1628 5.83239C22.4721 5.83239 22.7688 5.95529 22.9876 6.17404C23.2063 6.39279 23.3292 6.68948 23.3292 6.99884V15.164Z',
        stroke: '#05DF72',
        strokeWidth: '2.3329',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      })
    );
  }
  if (type === 'Balanced') {
    return React.createElement(
      'svg',
      { width: '28', height: '28', viewBox: '0 0 28 28', fill: 'none', className: 'w-[22px] h-[22px]' },
      React.createElement('path', {
        d: 'M25.662 8.16504L15.7472 18.0799L9.91493 12.2476L2.33301 19.8295',
        stroke: '#51A2FF',
        strokeWidth: '2.3329',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      React.createElement('path', {
        d: 'M18.6631 8.16504H25.6618V15.1637',
        stroke: '#51A2FF',
        strokeWidth: '2.3329',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      })
    );
  }
  return React.createElement(
    'svg',
    { width: '28', height: '28', viewBox: '0 0 28 28', fill: 'none', className: 'w-[22px] h-[22px]' },
    React.createElement('path', {
      d: 'M9.91461 16.9137C10.688 16.9137 11.4297 16.6064 11.9766 16.0596C12.5235 15.5127 12.8307 14.771 12.8307 13.9976C12.8307 12.3879 12.2475 11.6647 11.6643 10.4982C10.4138 7.99851 11.403 5.76942 13.9972 3.49951C14.5804 6.41564 16.3301 9.21512 18.663 11.0814C20.9959 12.9478 22.1623 15.164 22.1623 17.4969C22.1623 18.5692 21.9511 19.6309 21.5408 20.6216C21.1305 21.6122 20.529 22.5123 19.7708 23.2705C19.0126 24.0287 18.1125 24.6302 17.1218 25.0405C16.1312 25.4509 15.0694 25.6621 13.9972 25.6621C12.9249 25.6621 11.8632 25.4509 10.8725 25.0405C9.88187 24.6302 8.98175 24.0287 8.22355 23.2705C7.46534 22.5123 6.8639 21.6122 6.45357 20.6216C6.04323 19.6309 5.83203 18.5692 5.83203 17.4969C5.83203 16.152 6.3371 14.8211 6.99848 13.9976C6.99848 14.771 7.30571 15.5127 7.85259 16.0596C8.39947 16.6064 9.1412 16.9137 9.91461 16.9137Z',
      stroke: '#FF8904',
      strokeWidth: '2.3329',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    })
  );
}

export function RecentlyViewedRail({ recentIds, listings, onClear, onViewListing }: RecentlyViewedRailProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const viewedListings = recentIds
    .map((id) => listings.find((item) => item.id === id))
    .filter((item): item is Listing => !!item);

  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollLeft = el.scrollLeft;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < maxScrollLeft - 2);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      const timer = setTimeout(checkScroll, 100);
      return () => {
        el.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
        clearTimeout(timer);
      };
    }
  }, [recentIds, viewedListings.length]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (el) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (viewedListings.length === 0) {
    return null;
  }

  const handleCardClick = (listing: Listing) => {
    setSelectedListing(listing);
    onViewListing(listing.id);
  };

  return React.createElement(
    'section',
    {
      className: 'w-full mb-8 relative bg-gradient-to-r from-white/[0.02] to-transparent border border-white/5 rounded-2xl p-5',
      'aria-label': 'Recently viewed listings',
    },
    React.createElement(
      'div',
      { className: 'flex items-center justify-between mb-4' },
      React.createElement(
        'div',
        { className: 'flex items-center gap-2.5' },
        React.createElement(
          'div',
          {
            className: 'p-1.5 rounded-lg bg-white/5 border border-white/5 text-[#0FF0FC]',
            'aria-hidden': 'true',
          },
          React.createElement(
            'svg',
            { width: '16', height: '16', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2' },
            React.createElement('circle', { cx: '12', cy: '12', r: '10' }),
            React.createElement('polyline', { points: '12 6 12 12 16 14' })
          )
        ),
        React.createElement('h2', { className: 'text-base font-bold text-white tracking-wide' }, 'Recently Viewed'),
        React.createElement(
          'span',
          { className: 'text-xs text-white/40 font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/5' },
          String(viewedListings.length)
        )
      ),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: onClear,
          className:
            'focus-ring flex items-center gap-1.5 text-xs font-semibold text-white/50 hover:text-red-400 transition-colors bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 px-3 py-1.5 rounded-xl cursor-pointer',
          'aria-label': 'Clear recently viewed listings',
        },
        React.createElement(Trash2, { className: 'w-3.5 h-3.5' }),
        'Clear'
      )
    ),
    React.createElement(
      'div',
      { className: 'relative group/rail' },
      canScrollLeft &&
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => scroll('left'),
            className:
              'absolute left-[-16px] top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0A0A0A]/95 text-white/70 shadow-lg backdrop-blur-sm transition-all hover:bg-white/5 hover:text-white cursor-pointer active:scale-95',
            'aria-label': 'Scroll left',
          },
          React.createElement(ChevronLeft, { className: 'h-5 w-5' })
        ),
      canScrollRight &&
        React.createElement(
          'button',
          {
            type: 'button',
            onClick: () => scroll('right'),
            className:
              'absolute right-[-16px] top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#0A0A0A]/95 text-white/70 shadow-lg backdrop-blur-sm transition-all hover:bg-white/5 hover:text-white cursor-pointer active:scale-95',
            'aria-label': 'Scroll right',
          },
          React.createElement(ChevronRight, { className: 'h-5 w-5' })
        ),
      React.createElement(
        'div',
        {
          ref: scrollContainerRef,
          className: 'flex gap-4 overflow-x-auto pb-2 pt-1 scroll-smooth snap-x snap-mandatory focus-ring',
          style: { scrollbarWidth: 'none', msOverflowStyle: 'none' },
          tabIndex: 0,
          'aria-label': 'Recently viewed listings rail',
          onKeyDown: (e) => {
            if (e.key === 'ArrowLeft') {
              scroll('left');
            } else if (e.key === 'ArrowRight') {
              scroll('right');
            }
          },
        },
        viewedListings.map((listing) => {
          const cardBorderClass =
            listing.type === 'Safe'
              ? 'border-[#00C95033] hover:border-[#00C95066]'
              : listing.type === 'Balanced'
              ? 'border-[#2B7FFF33] hover:border-[#2B7FFF66]'
              : 'border-[#FF690033] hover:border-[#FF690066]';

          const scoreColorClass =
            listing.type === 'Safe'
              ? 'text-[#00C950]'
              : listing.type === 'Balanced'
              ? 'text-[#51A2FF]'
              : 'text-[#FF8904]';

          const badgeBgClass =
            listing.type === 'Safe'
              ? 'bg-[#0f2a1d] text-[#00C950]'
              : listing.type === 'Balanced'
              ? 'bg-[#122238] text-[#51A2FF]'
              : 'bg-[#2b1c10] text-[#FF8904]';

          return React.createElement(
            'div',
            { key: listing.id, className: 'snap-start shrink-0', role: 'listitem' },
            React.createElement(
              'button',
              {
                type: 'button',
                onClick: () => handleCardClick(listing),
                className: `focus-ring text-left flex flex-col w-[250px] rounded-xl p-4 bg-[#0E0E0E] border ${cardBorderClass} transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.5)] cursor-pointer`,
                'aria-label': `Recently viewed commitment ${listing.id}, type ${listing.type}, yield ${listing.yield}. Click to open details.`,
              },
              React.createElement(
                'div',
                { className: 'flex items-center justify-between mb-2 w-full' },
                React.createElement(
                  'span',
                  { className: 'font-mono text-xs text-white/50' },
                  '#CMT-' + listing.id.padStart(3, '0')
                ),
                React.createElement(
                  'span',
                  { className: `text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeBgClass}` },
                  listing.type
                )
              ),
              React.createElement(
                'div',
                { className: 'flex items-baseline justify-between mb-2 w-full' },
                React.createElement('span', { className: 'text-[20px] font-bold text-white leading-none' }, listing.yield),
                React.createElement('span', { className: `text-xs font-bold ${scoreColorClass}` }, listing.score + '% Score')
              ),
              React.createElement(
                'div',
                { className: 'grid grid-cols-2 gap-2 mt-1 border-t border-white/5 pt-2 text-[11px] w-full' },
                React.createElement(
                  'div',
                  null,
                  React.createElement('div', { className: 'text-white/40 mb-0.5' }, 'Amount'),
                  React.createElement('div', { className: 'font-semibold text-white/90' }, listing.amount)
                ),
                React.createElement(
                  'div',
                  null,
                  React.createElement('div', { className: 'text-white/40 mb-0.5' }, 'Price'),
                  React.createElement(
                    'div',
                    { className: 'font-semibold text-white/90' },
                    listing.forSale ? listing.price : 'NFS'
                  )
                )
              )
            )
          );
        })
      )
    ),
    selectedListing &&
      React.createElement(CommitmentDetailsModal, {
        isOpen: !!selectedListing,
        onClose: () => setSelectedListing(null),
        commitmentId: selectedListing.id,
        typeLabel: selectedListing.type + ' Commitment',
        typeVariant: selectedListing.type.toLowerCase() as any,
        currentPrice: selectedListing.price,
        amountCommitted: selectedListing.amount,
        remainingDuration: selectedListing.duration,
        currentYield: selectedListing.yield,
        maxLoss: selectedListing.maxLoss,
        complianceItems: [
          {
            id: 'volatility-exposure',
            label: 'Volatility Exposure',
            statusLabel: 'Within limits',
            statusVariant: 'ok',
          },
          {
            id: 'fee-generation',
            label: 'Fee Generation',
            statusLabel: 'On track',
            statusVariant: 'ok',
          },
          {
            id: 'drawdown-events',
            label: 'Drawdown Events',
            statusLabel: 'None detected',
            statusVariant: 'ok',
          },
        ],
        reputationScore: selectedListing.score,
        TypeIcon: TypeIcon,
      })
  );
}
