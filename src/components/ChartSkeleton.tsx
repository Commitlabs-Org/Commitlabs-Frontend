'use client';

import React from 'react';
import { Skeleton } from './ui/Skeleton';

export function ChartSkeleton() {
  return (
    <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] animate-shimmer overflow-hidden">
      <div className="flex justify-between items-center mb-8">
        <Skeleton className="w-32 h-6" />
        <div className="flex gap-4">
          <Skeleton className="w-20 h-4 rounded-full" />
          <Skeleton className="w-20 h-4 rounded-full" />
        </div>
      </div>
      
      {/* Simulation of a chart axis and lines */}
      <div className="relative h-[200px] mt-10">
        {/* Y Axis simulation */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-white/5" />
        {/* X Axis simulation */}
        <div className="absolute left-0 right-0 bottom-0 h-px bg-white/5" />
        
        {/* Shimmering chart lines (simplified) */}
        <div className="absolute inset-0 flex items-end justify-between px-4">
          {[40, 70, 50, 90, 60, 80, 45, 75].map((h, i) => (
            <Skeleton key={i} className={`w-[2px] rounded-full`} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-[#222]">
        <Skeleton className="w-full h-4 mb-2" />
        <Skeleton className="w-3/4 h-4" />
      </div>
    </div>
  );
}
