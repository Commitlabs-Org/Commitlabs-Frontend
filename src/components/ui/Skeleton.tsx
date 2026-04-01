'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rect' | 'circle' | 'text';
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const baseClass = 'animate-shimmer rounded-md bg-white/5';
  const variantClass = 
    variant === 'circle' ? 'rounded-full' : 
    variant === 'text' ? 'h-4 w-full last:w-3/4' : 
    '';

  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`}
      aria-hidden="true"
    />
  );
}
