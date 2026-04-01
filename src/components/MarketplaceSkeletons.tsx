'use client';

import React from 'react';
import { Skeleton } from './ui/Skeleton';

export function MarketplaceCardSkeleton() {
  return (
    <div className="relative flex flex-col h-full rounded-[14px] p-[18px] bg-[#0A0A0AE5] border border-[rgba(255,255,255,0.08)] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between gap-3.5 mb-3.5">
        <Skeleton className="w-[52px] h-[52px] rounded-[14px]" />
        <div className="flex flex-col items-end gap-2">
          <Skeleton className="w-20 h-8 rounded-full" />
          <Skeleton className="w-16 h-8 rounded-[10px]" />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 pt-[10px] px-[2px] pb-0">
        <Skeleton className="w-24 h-4 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <Skeleton className="w-20 h-4" />
              <Skeleton className="w-24 h-4" />
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-6 pt-4 border-t border-white/10 grid gap-3.5">
        <Skeleton className="w-full h-[68px] rounded-[14px]" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-11 rounded-[14px]" />
          <Skeleton className="h-11 rounded-[14px]" />
        </div>
      </footer>
    </div>
  );
}

export function MarketplaceRowSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-2xl border border-white/10 bg-[#0A0A0A]/90 p-6 sm:p-5">
      <div className="flex items-center gap-4 min-w-[150px]">
        <Skeleton className="h-12 w-12 sm:h-10 sm:w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="w-16 h-4 rounded-full" />
          <Skeleton className="w-20 h-4" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 sm:flex sm:items-center gap-6 sm:gap-4 flex-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-2 min-w-[80px]">
            <Skeleton className="w-12 h-3" />
            <Skeleton className="w-16 h-6" />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-4 sm:pt-0 border-t border-white/5 sm:border-0">
        <Skeleton className="w-24 h-11 rounded-xl" />
        <Skeleton className="w-24 h-11 rounded-xl" />
      </div>
    </div>
  );
}
