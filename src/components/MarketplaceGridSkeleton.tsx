'use client';

import React from 'react';
import { MarketplaceCardSkeleton, FiltersSkeleton } from './Skeleton';

interface MarketplaceGridSkeletonProps {
  showFilters?: boolean;
  cardCount?: number;
}

/**
 * Skeleton loading component for the marketplace page
 * 
 * Features:
 * - Shows skeleton filters section (optional)
 * - Shows skeleton marketplace cards in grid layout
 * - Respects reduced motion preferences
 * - Provides accessible loading state
 */
export function MarketplaceGridSkeleton({
  showFilters = true,
  cardCount = 6,
}: MarketplaceGridSkeletonProps) {
  return (
    <div className="space-y-8" aria-label="Loading marketplace listings" role="status">
      {/* Filters skeleton */}
      {showFilters && (
        <div className="w-full">
          <FiltersSkeleton />
        </div>
      )}
      
      {/* Results layout skeleton */}
      <div className="flex items-center justify-between">
        <div className="text-[14px] text-[#94A3B8]">
          <div className="inline-block">
            <div className="w-12 h-6 bg-[#1a1a1a] rounded animate-pulse" />
          </div>
          {' '}listings found
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-8 bg-[#1a1a1a] rounded-lg" />
          <div className="w-24 h-8 bg-[#1a1a1a] rounded-lg" />
        </div>
      </div>
      
      {/* Marketplace cards grid skeleton */}
      <section aria-label="Marketplace listings">
        <ul className="list-none p-0 m-0 grid grid-cols-3 gap-6 max-[1024px]:grid-cols-2 max-[720px]:grid-cols-1">
          {Array.from({ length: cardCount }).map((_, index) => (
            <li key={index} className="min-h-[280px]">
              <MarketplaceCardSkeleton />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}