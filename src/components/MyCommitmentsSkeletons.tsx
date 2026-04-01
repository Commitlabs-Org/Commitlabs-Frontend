'use client';

import React from 'react';
import { Skeleton } from './ui/Skeleton';

export function MyCommitmentCardSkeleton() {
  return (
    <div className="relative flex flex-col gap-5 rounded-[16px] border border-white/10 bg-[rgba(13,13,13,0.8)] p-6 overflow-hidden">
      <div className="flex items-center justify-between">
        <Skeleton className="w-24 h-7 rounded-full" />
        <Skeleton className="w-20 h-7 rounded-full" />
      </div>

      <Skeleton className="w-32 h-4" />

      <div className="flex flex-col gap-2">
        <Skeleton className="w-48 h-10" />
        <Skeleton className="w-40 h-5" />
      </div>

      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="w-full h-3" />
            <Skeleton className="w-full h-1.5 rounded-full" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-14 rounded-[10px]" />
        <Skeleton className="h-14 rounded-[10px]" />
      </div>

      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-4" />
        </div>
        <div className="space-y-2 items-end flex flex-col">
          <Skeleton className="w-16 h-3" />
          <Skeleton className="w-20 h-4" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-2">
        <Skeleton className="h-10 rounded-[8px]" />
        <Skeleton className="h-10 rounded-[8px]" />
      </div>
    </div>
  );
}

export function MyCommitmentsStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="w-16 h-6" />
            <Skeleton className="w-32 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
