'use client';

import React from 'react';

/**
 * MyCommitmentsGridSkeleton
 *
 * Pulse-animated placeholder shown while commitment data is loading.
 * Matches the 3-column layout of MyCommitmentsGrid so there's no layout shift
 * when real cards arrive.
 */
export function MyCommitmentsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading commitments" aria-busy="true" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-24 rounded bg-white/10 animate-pulse" />
        <div className="h-4 w-32 rounded bg-white/10 animate-pulse" />
      </div>

      <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl border border-white/10 p-5 bg-white/[0.03]"
            aria-hidden="true"
          >
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-2">
                <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-white/10 animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex flex-col gap-1">
                  <div className="h-2.5 w-16 rounded bg-white/10 animate-pulse" />
                  <div className="h-4 w-20 rounded bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>

            <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />

            <div className="flex gap-2 pt-1 border-t border-white/5">
              {[0, 1].map((j) => (
                <div key={j} className="h-3 w-12 rounded bg-white/10 animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
