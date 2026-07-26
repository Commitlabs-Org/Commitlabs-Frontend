'use client';

import React from 'react';
import { HealthChartSkeleton } from './Skeleton';

interface HealthMetricsSkeletonProps {
  showTabs?: boolean;
  chartCount?: number;
}

/**
 * Skeleton loading component for health metrics charts
 * 
 * Features:
 * - Shows skeleton chart tabs (optional)
 * - Shows skeleton chart with grid lines and axes
 * - Respects reduced motion preferences
 * - Provides accessible loading state
 */
export default function HealthMetricsSkeleton({
  showTabs = true,
  chartCount = 1,
}: HealthMetricsSkeletonProps) {
  return (
    <div className="w-full bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]" aria-label="Loading health metrics" role="status">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="w-40 h-8 bg-[#1a1a1a] rounded" />
        
        {showTabs && (
          <div className="flex flex-wrap gap-2 p-1 bg-[#111] rounded-lg border border-[#222]">
            {['value', 'drawdown', 'fee', 'compliance'].map((tab) => (
              <div
                key={tab}
                className="w-24 h-10 bg-[#1a1a1a] rounded-md"
              />
            ))}
          </div>
        )}
      </div>
      
      <div className="w-full space-y-8">
        {Array.from({ length: chartCount }).map((_, index) => (
          <HealthChartSkeleton key={index} />
        ))}
      </div>
      
      {/* Additional metrics skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-[#111] border border-[#222] rounded-xl p-4">
            <div className="w-16 h-4 bg-[#1a1a1a] rounded mb-2" />
            <div className="w-24 h-6 bg-[#1a1a1a] rounded" />
            <div className="w-12 h-3 bg-[#1a1a1a] rounded mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}