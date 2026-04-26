'use client';

import React, { useEffect, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  shimmer?: boolean;
}

/**
 * Base skeleton component with reduced motion support
 *
 * Accessibility considerations:
 * - Uses `prefers-reduced-motion` media query to disable animations
 * - Provides static loading state for users with motion sensitivity
 * - Includes aria-label for screen readers
 */
export function Skeleton({
  className,
  width,
  height,
  rounded = 'md',
  shimmer = true,
}: SkeletonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const borderRadius = {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  }[rounded];

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#1a1a1a]',
        borderRadius,
        className
      )}
      style={style}
      aria-label="Loading content"
      role="status"
    >
      {/* Base background */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#222] to-[#1a1a1a]" />
      
      {/* Shimmer effect with reduced motion support */}
      {shimmer && !prefersReducedMotion && (
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent"
          style={{
            animation: 'shimmer 2s infinite',
            animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}
      
      {/* Static loading indicator for reduced motion */}
      {shimmer && prefersReducedMotion && (
        <div className="absolute inset-0 bg-gradient-to-r from-[#1a1a1a] via-[#252525] to-[#1a1a1a]" />
      )}
    </div>
  );
}

/**
 * Skeleton for commitment cards in the commitments list
 */
export function CommitmentCardSkeleton() {
  return (
    <div className="bg-[#0a0a0a] border border-[#222] rounded-xl p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <Skeleton width={120} height={24} />
          <Skeleton width={80} height={20} />
        </div>
        <Skeleton width={60} height={24} rounded="full" />
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={16} />
        </div>
      </div>
      
      <div className="space-y-2">
        <Skeleton width="100%" height={8} />
        <div className="flex justify-between text-sm">
          <Skeleton width={40} height={14} />
          <Skeleton width={40} height={14} />
        </div>
      </div>
      
      <div className="flex gap-3 mt-6">
        <Skeleton width="100%" height={36} />
        <Skeleton width="100%" height={36} />
      </div>
    </div>
  );
}

/**
 * Skeleton for marketplace cards
 */
export function MarketplaceCardSkeleton() {
  return (
    <div className="bg-gradient-to-b from-[#0a0a0a] to-[#111] border border-[#222] rounded-xl p-5">
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-2">
          <Skeleton width={100} height={24} />
          <Skeleton width={60} height={20} />
        </div>
        <Skeleton width={80} height={28} rounded="full" />
      </div>
      
      <div className="space-y-3 mb-6">
        <div className="flex justify-between">
          <Skeleton width={60} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={60} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={60} height={16} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="flex justify-between">
          <Skeleton width={60} height={16} />
          <Skeleton width={100} height={16} />
        </div>
      </div>
      
      <div className="border-t border-[#222] pt-4">
        <div className="flex justify-between items-center">
          <Skeleton width={80} height={16} />
          <Skeleton width={100} height={32} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for health metrics charts
 */
export function HealthChartSkeleton() {
  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
      <div className="flex justify-between items-center mb-6">
        <Skeleton width={120} height={28} />
        <div className="flex gap-2">
          <Skeleton width={80} height={32} rounded="lg" />
          <Skeleton width={80} height={32} rounded="lg" />
          <Skeleton width={80} height={32} rounded="lg" />
        </div>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between">
          <Skeleton width={60} height={16} />
          <Skeleton width={80} height={16} />
        </div>
        
        {/* Chart area */}
        <div className="relative h-[300px]">
          {/* Y-axis */}
          <div className="absolute left-0 top-0 bottom-0 w-12 space-y-8">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} width={40} height={1} />
            ))}
          </div>
          
          {/* X-axis */}
          <div className="absolute left-12 right-0 bottom-0 h-6 flex justify-between">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} width={40} height={1} />
            ))}
          </div>
          
          {/* Chart lines */}
          <div className="absolute left-12 right-4 top-4 bottom-10">
            <div className="relative h-full">
              {/* Grid lines */}
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 h-px bg-[#222]"
                  style={{ top: `${(i + 1) * 25}%` }}
                />
              ))}
              
              {/* Simulated chart line */}
              <div className="absolute inset-0">
                <svg width="100%" height="100%" className="overflow-visible">
                  <path
                    d="M0,80 C40,60 80,40 120,60 C160,80 200,40 240,20 C280,0 320,40 360,60"
                    fill="none"
                    stroke="#333"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-center gap-6 mt-4">
          <Skeleton width={120} height={20} />
          <Skeleton width={120} height={20} />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for commitment stats
 */
export function CommitmentStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-4">
          <Skeleton width={80} height={16} className="mb-2" />
          <Skeleton width={120} height={28} />
          <Skeleton width={60} height={14} className="mt-2" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for filters section
 */
export function FiltersSkeleton() {
  return (
    <div className="flex flex-wrap gap-4 p-4 bg-[#0a0a0a] border border-[#222] rounded-xl">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} width={100} height={36} rounded="lg" />
      ))}
    </div>
  );
}