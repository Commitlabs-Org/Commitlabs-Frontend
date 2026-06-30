// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SavedSearches from './SavedSearches';
import type { Filters } from '@/hooks/useMarketplaceFilters';

// Mock useWallet
vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    address: 'GABCDE123456FGHIJK789012',
  }),
}));

const mockFilters: Filters = {
  sortBy: 'price',
  commitmentType: ['balanced'],
  priceRange: [0, 1000000],
  durationRange: [0, 90],
  minCompliance: 0,
  maxLoss: 100,
};

describe('SavedSearches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  it('renders the Saved Searches toggle button', () => {
    render(<SavedSearches filters={mockFilters} onApplyFilters={() => {}} />);
    expect(screen.getByText('Saved Searches')).toBeInTheDocument();
  });

  it('expands to show save button when clicked', () => {
    render(<SavedSearches filters={mockFilters} onApplyFilters={() => {}} />);
    fireEvent.click(screen.getByText('Saved Searches'));
    expect(screen.getByText('Save this search')).toBeInTheDocument();
  });

  it('shows name input when "Save this search" is clicked', () => {
    render(<SavedSearches filters={mockFilters} onApplyFilters={() => {}} />);
    fireEvent.click(screen.getByText('Saved Searches'));
    fireEvent.click(screen.getByText('Save this search'));
    expect(screen.getByPlaceholderText('Search name...')).toBeInTheDocument();
  });

  it('overwrites existing search when using duplicate name', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          preferences: {
            savedMarketplaceSearches: [
              {
                id: '1',
                name: 'Test Search',
                filters: mockFilters,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const onApplyFilters = vi.fn();
    render(<SavedSearches filters={mockFilters} onApplyFilters={onApplyFilters} />);
    fireEvent.click(screen.getByText('Saved Searches'));
    
    await waitFor(() => screen.getByText('Test Search'));

    fireEvent.click(screen.getByText('Save this search'));
    fireEvent.change(screen.getByPlaceholderText('Search name...'), { target: { value: 'Test Search' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('deletes a saved search', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          preferences: {
            savedMarketplaceSearches: [
              {
                id: '1',
                name: 'Delete Me',
                filters: mockFilters,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    render(<SavedSearches filters={mockFilters} onApplyFilters={() => {}} />);
    fireEvent.click(screen.getByText('Saved Searches'));

    await waitFor(() => screen.getByText('Delete Me'));
    
    const deleteButton = screen.getByLabelText('Delete search');
    fireEvent.click(deleteButton);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('calls onApplyFilters when a saved search is selected', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          preferences: {
            savedMarketplaceSearches: [
              {
                id: '1',
                name: 'Apply Me',
                filters: mockFilters,
                createdAt: '2026-01-01T00:00:00.000Z',
              },
            ],
          },
        },
      }),
    });

    const onApplyFilters = vi.fn();
    render(<SavedSearches filters={mockFilters} onApplyFilters={onApplyFilters} />);
    fireEvent.click(screen.getByText('Saved Searches'));

    await waitFor(() => screen.getByText('Apply Me'));
    fireEvent.click(screen.getByText('Apply Me'));

    expect(onApplyFilters).toHaveBeenCalledWith(mockFilters);
  });
});
