import { useState, useEffect, useCallback } from 'react';
import { FilterState, DEFAULT_FILTERS, FilterUtils, FilterValidation } from "../types/MarketplaceFilters.types";

/**
 * Custom hook for managing marketplace filter state with URL persistence
 * 
 * This hook:
 * - Maintains filter state in component state
 * - Syncs filters with URL query parameters
 * - Provides utilities for resetting and counting active filters
 * - Validates filter values
 * 
 * @param initialFilters - Optional initial filter state (overrides URL params)
 * @param syncWithURL - Whether to sync state with URL query parameters (default: true)
 * 
 * @example
 * ```tsx
 * function MarketplacePage() {
 *   const { filters, setFilters, resetFilters, activeCount } = useMarketplaceFilters();
 * 
 *   return (
 *     <div>
 *       <MarketplaceFilters
 *         filters={filters}
 *         onFilterChange={setFilters}
 *       />
 *       <div>Active filters: {activeCount}</div>
 *     </div>
 *   );
 * }
 * ```
 */
export const useMarketplaceFilters = (
  initialFilters?: Partial<FilterState>,
  syncWithURL: boolean = true
) => {
  // Initialize filters from URL params or defaults
  const getInitialFilters = useCallback((): FilterState => {
    if (!syncWithURL || typeof window === 'undefined') {
      return { ...DEFAULT_FILTERS, ...initialFilters };
    }

    const params = new URLSearchParams(window.location.search);
    const urlFilters = FilterUtils.fromQueryParams(params);
    
    return FilterValidation.normalize({
      ...DEFAULT_FILTERS,
      ...urlFilters,
      ...initialFilters
    });
  }, [initialFilters, syncWithURL]);

  const [filters, setFiltersState] = useState<FilterState>(getInitialFilters);

  // Sync filters to URL when they change
  useEffect(() => {
    if (!syncWithURL || typeof window === 'undefined') return;

    const params = FilterUtils.toQueryParams(filters);
    const newURL = `${window.location.pathname}?${params.toString()}`;
    
    // Only update if URL actually changed
    if (newURL !== window.location.pathname + window.location.search) {
      window.history.replaceState({}, '', newURL);
    }
  }, [filters, syncWithURL]);

  // Wrapped setter that validates and normalizes
  const setFilters = useCallback((newFilters: FilterState | ((prev: FilterState) => FilterState)) => {
    setFiltersState(prev => {
      const updated = typeof newFilters === 'function' ? newFilters(prev) : newFilters;
      return FilterValidation.normalize(updated);
    });
  }, []);

  // Reset to defaults
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  // Count active filters
  const activeCount = FilterUtils.countActive(filters);

  // Check if at defaults
  const isDefault = FilterUtils.isDefault(filters);

  return {
    filters,
    setFilters,
    resetFilters,
    activeCount,
    isDefault
  };
};

/**
 * Hook for filtering commitment data based on filter state
 * 
 * @param commitments - Array of commitment data
 * @param filters - Current filter state
 * @returns Filtered and sorted commitments
 * 
 * @example
 * ```tsx
 * const { filters } = useMarketplaceFilters();
 * const filteredCommitments = useFilteredCommitments(allCommitments, filters);
 * ```
 */
export const useFilteredCommitments = <T extends {
  type: string;
  price: number;
  duration: number;
  complianceScore: number;
  maxLossThreshold: number;
  createdAt: string;
}>(
  commitments: T[],
  filters: FilterState
): T[] => {
  return commitments
    .filter(commitment => {
      // Filter by type
      if (commitment.type !== filters.commitmentType) return false;

      // Filter by price range
      if (commitment.price < filters.priceRange[0] || commitment.price > filters.priceRange[1]) {
        return false;
      }

      // Filter by duration
      if (commitment.duration < filters.durationRange[0] || commitment.duration > filters.durationRange[1]) {
        return false;
      }

      // Filter by min compliance
      if (commitment.complianceScore < filters.minCompliance) {
        return false;
      }

      // Filter by max loss threshold
      if (commitment.maxLossThreshold > filters.maxLoss) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // Sort based on sortBy option
      switch (filters.sortBy) {
        case 'price':
          return a.price - b.price;
        case 'price-desc':
          return b.price - a.price;
        case 'compliance':
          return b.complianceScore - a.complianceScore;
        case 'duration':
          return a.duration - b.duration;
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });
};

/**
 * Hook for debouncing filter changes to reduce API calls
 * 
 * @param filters - Current filter state
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 * @returns Debounced filter state
 * 
 * @example
 * ```tsx
 * const { filters } = useMarketplaceFilters();
 * const debouncedFilters = useDebouncedFilters(filters, 300);
 * 
 * // Use debouncedFilters for API calls
 * useEffect(() => {
 *   fetchCommitments(debouncedFilters);
 * }, [debouncedFilters]);
 * ```
 */
export const useDebouncedFilters = (
  filters: FilterState,
  delay: number = 500
): FilterState => {
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [filters, delay]);

  return debouncedFilters;
};

export default useMarketplaceFilters;