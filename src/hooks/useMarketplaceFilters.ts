'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export type CommitmentType = 'balanced' | 'aggressive' | 'conservative';

export interface Filters {
  sortBy: string;
  commitmentType: CommitmentType[];
  priceRange: [number, number];
  durationRange: [number, number];
  minCompliance: number;
  maxLoss: number;
}

const DEFAULT_FILTERS: Filters = {
  sortBy: 'price',
  commitmentType: ['balanced'],
  priceRange: [0, 1000000],
  durationRange: [0, 90],
  minCompliance: 0,
  maxLoss: 100,
};

function serializeFilters(filters: Filters): Record<string, string> {
  const params: Record<string, string> = {};
  params.sortBy = filters.sortBy;
  params.commitmentType = filters.commitmentType.join(',');
  params.priceRange = filters.priceRange.join(',');
  params.durationRange = filters.durationRange.join(',');
  params.minCompliance = String(filters.minCompliance);
  params.maxLoss = String(filters.maxLoss);
  return params;
}

function deserializeFilters(params: URLSearchParams): Filters {
  try {
    const filters: Filters = { ...DEFAULT_FILTERS };

    const sortBy = params.get('sortBy');
    if (sortBy) filters.sortBy = sortBy;

    const commitmentType = params.get('commitmentType');
    if (commitmentType) {
      const types = commitmentType.split(',') as CommitmentType[];
      const validTypes: CommitmentType[] = types.filter((t) =>
        ['balanced', 'aggressive', 'conservative'].includes(t)
      );
      if (validTypes.length > 0) filters.commitmentType = validTypes;
    }

    const priceRange = params.get('priceRange');
    if (priceRange) {
      const [min, max] = priceRange.split(',').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        // Clamp to valid range and ensure min < max
        const clampedMin = Math.max(0, Math.min(min, 1000000));
        const clampedMax = Math.max(0, Math.min(max, 1000000));
        filters.priceRange = [Math.min(clampedMin, clampedMax), Math.max(clampedMin, clampedMax)];
      }
    }

    const durationRange = params.get('durationRange');
    if (durationRange) {
      const [min, max] = durationRange.split(',').map(Number);
      if (!isNaN(min) && !isNaN(max)) {
        // Clamp to valid range and ensure min < max
        const clampedMin = Math.max(0, Math.min(min, 90));
        const clampedMax = Math.max(0, Math.min(max, 90));
        filters.durationRange = [Math.min(clampedMin, clampedMax), Math.max(clampedMin, clampedMax)];
      }
    }

    const minCompliance = params.get('minCompliance');
    if (minCompliance && !isNaN(Number(minCompliance))) {
      // Clamp to 0-100 range
      filters.minCompliance = Math.max(0, Math.min(Number(minCompliance), 100));
    }

    const maxLoss = params.get('maxLoss');
    if (maxLoss && !isNaN(Number(maxLoss))) {
      // Clamp to 0-100 range (non-negative)
      filters.maxLoss = Math.max(0, Math.min(Number(maxLoss), 100));
    }

    return filters;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function useMarketplaceFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() =>
    deserializeFilters(searchParams)
  );

  // Update URL when filters change
  const updateFilters = useCallback(
    (newFilters: Filters) => {
      setFilters(newFilters);
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeFilters(newFilters);
      Object.entries(serialized).forEach(([key, value]) => {
        params.set(key, value);
      });
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  // Hydrate from URL on initial load
  useEffect(() => {
    const urlFilters = deserializeFilters(searchParams);
    setFilters(urlFilters);
  }, [searchParams]);

  const resetFilters = useCallback(() => {
    updateFilters(DEFAULT_FILTERS);
  }, [updateFilters]);

  return {
    filters,
    updateFilters,
    resetFilters,
  };
}
