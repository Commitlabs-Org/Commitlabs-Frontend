// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarketplaceFilters } from '../useMarketplaceFilters';

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/marketplace',
}));

describe('useMarketplaceFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete('sortBy');
    mockSearchParams.delete('commitmentType');
    mockSearchParams.delete('priceRange');
    mockSearchParams.delete('durationRange');
    mockSearchParams.delete('minCompliance');
    mockSearchParams.delete('maxLoss');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns default filters when no URL params are present', () => {
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters).toEqual({
      sortBy: 'price',
      commitmentType: ['balanced'],
      priceRange: [0, 1000000],
      durationRange: [0, 90],
      minCompliance: 0,
      maxLoss: 100,
    });
  });

  it('hydrates filters from valid URL params', () => {
    mockSearchParams.set('sortBy', 'compliance');
    mockSearchParams.set('commitmentType', 'balanced,aggressive');
    mockSearchParams.set('priceRange', '0,500000');
    mockSearchParams.set('durationRange', '0,60');
    mockSearchParams.set('minCompliance', '80');
    mockSearchParams.set('maxLoss', '50');

    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters).toEqual({
      sortBy: 'compliance',
      commitmentType: ['balanced', 'aggressive'],
      priceRange: [0, 500000],
      durationRange: [0, 60],
      minCompliance: 80,
      maxLoss: 50,
    });
  });

  it('falls back to defaults for malformed URL params', () => {
    mockSearchParams.set('sortBy', 'invalid');
    mockSearchParams.set('commitmentType', 'invalid,balanced');
    mockSearchParams.set('priceRange', 'not,numbers');
    mockSearchParams.set('durationRange', 'abc,def');
    mockSearchParams.set('minCompliance', 'invalid');
    mockSearchParams.set('maxLoss', 'invalid');

    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters).toEqual({
      sortBy: 'invalid', // We keep the value even if it's not in our predefined list
      commitmentType: ['balanced'],
      priceRange: [0, 1000000],
      durationRange: [0, 90],
      minCompliance: 0,
      maxLoss: 100,
    });
  });

  it('updates URL when filters change', async () => {
    const { result } = renderHook(() => useMarketplaceFilters());

    const newFilters = {
      sortBy: 'price-desc',
      commitmentType: ['conservative'],
      priceRange: [0, 250000],
      durationRange: [0, 30],
      minCompliance: 90,
      maxLoss: 10,
    };

    act(() => {
      result.current.updateFilters(newFilters);
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalled();
    });
  });

  it('resets to default filters', () => {
    const { result } = renderHook(() => useMarketplaceFilters());

    const customFilters = {
      sortBy: 'price-desc',
      commitmentType: ['aggressive'],
      priceRange: [0, 250000],
      durationRange: [0, 30],
      minCompliance: 90,
      maxLoss: 10,
    };

    act(() => {
      result.current.updateFilters(customFilters);
    });

    act(() => {
      result.current.resetFilters();
    });

    expect(result.current.filters).toEqual({
      sortBy: 'price',
      commitmentType: ['balanced'],
      priceRange: [0, 1000000],
      durationRange: [0, 90],
      minCompliance: 0,
      maxLoss: 100,
    });
  });

  it('clamps out-of-range minCompliance to 0-100', () => {
    mockSearchParams.set('minCompliance', '500');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters.minCompliance).toBe(100);

    mockSearchParams.set('minCompliance', '-50');
    const { result: result2 } = renderHook(() => useMarketplaceFilters());
    expect(result2.current.filters.minCompliance).toBe(0);
  });

  it('clamps out-of-range maxLoss to 0-100', () => {
    mockSearchParams.set('maxLoss', '500');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters.maxLoss).toBe(100);

    mockSearchParams.set('maxLoss', '-50');
    const { result: result2 } = renderHook(() => useMarketplaceFilters());
    expect(result2.current.filters.maxLoss).toBe(0);
  });

  it('clamps out-of-range priceRange to [0, 1000000]', () => {
    mockSearchParams.set('priceRange', '999999,-5');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters.priceRange).toEqual([0, 1000000]);

    mockSearchParams.set('priceRange', '-100,2000000');
    const { result: result2 } = renderHook(() => useMarketplaceFilters());
    expect(result2.current.filters.priceRange).toEqual([0, 1000000]);
  });

  it('clamps out-of-range durationRange to [0, 90]', () => {
    mockSearchParams.set('durationRange', '100,200');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters.durationRange).toEqual([90, 90]);

    mockSearchParams.set('durationRange', '-10,-5');
    const { result: result2 } = renderHook(() => useMarketplaceFilters());
    expect(result2.current.filters.durationRange).toEqual([0, 0]);
  });

  it('corrects inverted range values', () => {
    mockSearchParams.set('priceRange', '500000,100000');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters.priceRange).toEqual([100000, 500000]);

    mockSearchParams.set('durationRange', '60,30');
    const { result: result2 } = renderHook(() => useMarketplaceFilters());
    expect(result2.current.filters.durationRange).toEqual([30, 60]);
  });

  it('handles combination of out-of-range and inverted values', () => {
    mockSearchParams.set('priceRange', '999999,-5');
    mockSearchParams.set('durationRange', '100,-10');
    mockSearchParams.set('minCompliance', '500');
    mockSearchParams.set('maxLoss', '-50');
    const { result } = renderHook(() => useMarketplaceFilters());
    expect(result.current.filters).toEqual({
      sortBy: 'price',
      commitmentType: ['balanced'],
      priceRange: [0, 1000000],
      durationRange: [0, 90],
      minCompliance: 100,
      maxLoss: 0,
    });
  });
});
