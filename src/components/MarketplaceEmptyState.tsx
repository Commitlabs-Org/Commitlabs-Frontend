'use client';

import React from 'react';
import ErrorLayout from './ErrorLayout';

export type MarketplaceEmptyStateType = 'empty' | 'filtered' | 'error';

export interface MarketplaceEmptyStateProps {
  type: MarketplaceEmptyStateType;
  onRetry?: () => void;
  onClearFilters?: () => void;
}

export function MarketplaceEmptyState({
  type,
  onRetry,
  onClearFilters,
}: MarketplaceEmptyStateProps) {
  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d4ff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]';

  if (type === 'error') {
    return (
      <ErrorLayout>
        <section className="mt-10" aria-label="Error loading listings">
          <div
            id="marketplace-error-state"
            tabIndex={-1}
            className="focus-ring rounded-[20px] px-6 py-8 text-center border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <p className="text-[1.1rem] font-semibold mb-2 text-red-400">
              Failed to load commitments
            </p>
            <p className="text-[0.95rem] text-white/70 mb-5">
              Something went wrong while fetching the listings. Please try again.
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={`${focusRing} rounded-xl border px-6 py-3 text-[0.95rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 border-[rgba(255,255,255,0.15)]`}
                aria-label="Retry loading listings"
              >
                Try Again
              </button>
            )}
          </div>
        </section>
      </ErrorLayout>
    );
  }

  return (
    <section className="mt-10" aria-label="No listings">
      <div
        id="marketplace-empty-state"
        tabIndex={-1}
        className="focus-ring rounded-[20px] px-6 py-8 text-center border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,255,255,0.06),rgba(255,255,255,0.01)_65%),rgba(0,0,0,0.45)] shadow-[0_18px_45px_rgba(0,0,0,0.55),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        {type === 'empty' ? (
          <>
            <p className="text-[1.1rem] font-semibold mb-2">
              No commitments available
            </p>
            <p className="text-[0.95rem] text-white/70">
              New offers will appear here once they are listed.
            </p>
          </>
        ) : (
          <>
            <p className="text-[1.1rem] font-semibold mb-2">
              No commitments match your filters
            </p>
            <p className="text-[0.95rem] text-white/70 mb-5">
              Try adjusting or clearing your filters to see more results.
            </p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className={`${focusRing} rounded-xl border px-6 py-3 text-[0.95rem] bg-[rgba(8,12,16,0.95)] text-white/90 transition-[border-color,box-shadow,background] duration-200 ease-[ease] hover:border-[rgba(0,212,255,0.45)] hover:shadow-[0_0_10px_rgba(0,212,255,0.2)] active:scale-95 border-[rgba(255,255,255,0.15)]`}
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
