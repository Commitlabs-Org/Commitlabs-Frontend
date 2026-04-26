'use client';

import React from 'react';
import { CommitmentCardSkeleton, CommitmentStatsSkeleton, FiltersSkeleton } from './Skeleton';

interface MyCommitmentsGridSkeletonProps {
  showStats?: boolean;
  showFilters?: boolean;
  cardCount?: number;
}

/**
 * Skeleton loading component for the commitments list page
 * 
 * Features:
 * - Shows skeleton stats section (optional)
 * - Shows skeleton filters section (optional)
 * - Shows skeleton commitment cards in grid layout
 * - Respects reduced motion preferences
 * - Provides accessible loading state
 */
export default function MyCommitmentsGridSkeleton({
  showStats = true,
  showFilters = true,
  cardCount = 6,
}: MyCommitmentsGridSkeletonProps) {
  return (
    <div className="flex flex-col gap-8" aria-label="Loading commitments" role="status">
      {/* Stats skeleton */}
      {showStats && (
        <div className="w-full">
          <CommitmentStatsSkeleton />
        </div>
      )}
      
      {/* Filters skeleton */}
      {showFilters && (
        <div className="w-full">
          <FiltersSkeleton />
        </div>
      )}
      
      {/* Results count skeleton */}
      <div className="text-[14px] text-[#94A3B8]">
        <div className="inline-block">
          <div className="w-12 h-6 bg-[#1a1a1a] rounded animate-pulse" />
        </div>
        {' '}commitments found
      </div>
      
      {/* Commitment cards grid skeleton */}
      <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
        {Array.from({ length: cardCount }).map((_, index) => (
          <CommitmentCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}