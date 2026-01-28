/**
 * MarketplaceFilters TypeScript Definitions
 * 
 * Type definitions for the Commitment Marketplace filters component
 */

export interface FilterState {
  /** Current sorting method */
  sortBy: 'price' | 'price-desc' | 'compliance' | 'duration' | 'newest' | 'oldest';
  
  /** Selected commitment type */
  commitmentType: 'safe' | 'balanced' | 'aggressive';
  
  /** Price range in dollars [min, max] */
  priceRange: [number, number];
  
  /** Duration range in days [min, max] */
  durationRange: [number, number];
  
  /** Minimum compliance score percentage (0-100) */
  minCompliance: number;
  
  /** Maximum loss threshold percentage (0-100) */
  maxLoss: number;
}

export interface MarketplaceFiltersProps {
  /** Current filter state */
  filters?: FilterState;
  
  /** Callback fired when any filter changes */
  onFilterChange?: (filters: FilterState) => void;
  
  /** Controls mobile drawer visibility */
  isOpen?: boolean;
  
  /** Callback to close mobile drawer */
  onClose?: () => void;
}

/**
 * Default filter values
 */
export const DEFAULT_FILTERS: FilterState = {
  sortBy: 'price',
  commitmentType: 'balanced',
  priceRange: [0, 1000000],
  durationRange: [0, 90],
  minCompliance: 0,
  maxLoss: 100
};

/**
 * Filter validation utilities
 */
export const FilterValidation = {
  /**
   * Validates a filter state object
   */
  isValid(filters: Partial<FilterState>): boolean {
    if (!filters) return false;
    
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (min < 0 || max > 1000000 || min > max) return false;
    }
    
    if (filters.durationRange) {
      const [min, max] = filters.durationRange;
      if (min < 0 || max > 90 || min > max) return false;
    }
    
    if (filters.minCompliance !== undefined) {
      if (filters.minCompliance < 0 || filters.minCompliance > 100) return false;
    }
    
    if (filters.maxLoss !== undefined) {
      if (filters.maxLoss < 0 || filters.maxLoss > 100) return false;
    }
    
    return true;
  },

  /**
   * Normalizes filter values to ensure they're within valid ranges
   */
  normalize(filters: Partial<FilterState>): FilterState {
    return {
      sortBy: filters.sortBy || DEFAULT_FILTERS.sortBy,
      commitmentType: filters.commitmentType || DEFAULT_FILTERS.commitmentType,
      priceRange: filters.priceRange?.map((v, i) => 
        Math.max(0, Math.min(i === 0 ? v : 1000000, v))
      ) as [number, number] || DEFAULT_FILTERS.priceRange,
      durationRange: filters.durationRange?.map((v, i) => 
        Math.max(0, Math.min(i === 0 ? v : 90, v))
      ) as [number, number] || DEFAULT_FILTERS.durationRange,
      minCompliance: Math.max(0, Math.min(100, filters.minCompliance || 0)),
      maxLoss: Math.max(0, Math.min(100, filters.maxLoss || 100))
    };
  }
};

/**
 * Utility functions for working with filters
 */
export const FilterUtils = {
  /**
   * Converts filter state to URL query parameters
   */
  toQueryParams(filters: FilterState): URLSearchParams {
    const params = new URLSearchParams();
    
    params.set('sort', filters.sortBy);
    params.set('type', filters.commitmentType);
    params.set('priceMin', filters.priceRange[0].toString());
    params.set('priceMax', filters.priceRange[1].toString());
    params.set('durationMin', filters.durationRange[0].toString());
    params.set('durationMax', filters.durationRange[1].toString());
    params.set('minCompliance', filters.minCompliance.toString());
    params.set('maxLoss', filters.maxLoss.toString());
    
    return params;
  },

  /**
   * Parses URL query parameters into filter state
   */
  fromQueryParams(params: URLSearchParams): Partial<FilterState> {
    const filters: Partial<FilterState> = {};
    
    const sortBy = params.get('sort');
    if (sortBy) filters.sortBy = sortBy as FilterState['sortBy'];
    
    const type = params.get('type');
    if (type) filters.commitmentType = type as FilterState['commitmentType'];
    
    const priceMin = params.get('priceMin');
    const priceMax = params.get('priceMax');
    if (priceMin && priceMax) {
      filters.priceRange = [Number(priceMin), Number(priceMax)];
    }
    
    const durationMin = params.get('durationMin');
    const durationMax = params.get('durationMax');
    if (durationMin && durationMax) {
      filters.durationRange = [Number(durationMin), Number(durationMax)];
    }
    
    const minCompliance = params.get('minCompliance');
    if (minCompliance) filters.minCompliance = Number(minCompliance);
    
    const maxLoss = params.get('maxLoss');
    if (maxLoss) filters.maxLoss = Number(maxLoss);
    
    return filters;
  },

  /**
   * Checks if filters are at default values
   */
  isDefault(filters: FilterState): boolean {
    return JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);
  },

  /**
   * Counts how many filters are actively applied (non-default)
   */
  countActive(filters: FilterState): number {
    let count = 0;
    
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) count++;
    if (filters.commitmentType !== DEFAULT_FILTERS.commitmentType) count++;
    if (JSON.stringify(filters.priceRange) !== JSON.stringify(DEFAULT_FILTERS.priceRange)) count++;
    if (JSON.stringify(filters.durationRange) !== JSON.stringify(DEFAULT_FILTERS.durationRange)) count++;
    if (filters.minCompliance !== DEFAULT_FILTERS.minCompliance) count++;
    if (filters.maxLoss !== DEFAULT_FILTERS.maxLoss) count++;
    
    return count;
  }
};

/**
 * Example API integration types
 */
export interface CommitmentData {
  id: string;
  type: 'safe' | 'balanced' | 'aggressive';
  price: number;
  duration: number;
  complianceScore: number;
  maxLossThreshold: number;
  createdAt: string;
  // ... other commitment fields
}

export interface FilteredCommitmentsResponse {
  commitments: CommitmentData[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Hook for managing filter state with URL persistence
 * 
 * @example
 * ```tsx
 * const { filters, setFilters, resetFilters } = useMarketplaceFilters();
 * 
 * return (
 *   <MarketplaceFilters
 *     filters={filters}
 *     onFilterChange={setFilters}
 *   />
 * );
 * ```
 */
export interface UseMarketplaceFiltersReturn {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  activeCount: number;
}