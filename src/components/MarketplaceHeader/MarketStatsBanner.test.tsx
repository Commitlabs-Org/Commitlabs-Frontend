// @vitest-environment happy-dom

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarketStatsBanner } from './MarketStatsBanner';
import { apiGet } from '@/lib/apiClient';

vi.mock('@/lib/apiClient', () => ({
  apiGet: vi.fn(),
}));

describe('MarketStatsBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    let resolvePromise: any;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    vi.mocked(apiGet).mockReturnValue(promise as any);

    render(<MarketStatsBanner />);

    // Verify skeleton/loading indicators are present
    expect(screen.getByLabelText('Loading market stats')).toBeInTheDocument();
    expect(screen.getAllByText('Loading metrics...').length).toBeGreaterThan(0);
    
    // Resolve to avoid unhandled promises in tests
    resolvePromise({ activeListings: 10, averageYield: 5, medianPrice: 100 });
  });

  it('renders success state with formatted KPI chips', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      activeListings: 1542,
      averageYield: 8.5,
      medianPrice: 250,
    });

    render(<MarketStatsBanner />);

    // Wait for the data to load and replace the loading state
    await waitFor(() => {
      expect(screen.queryByLabelText('Loading market stats')).not.toBeInTheDocument();
    });

    expect(screen.getByLabelText('Market statistics')).toBeInTheDocument();
    
    // Check if the specific KPI labels are rendered
    expect(screen.getByText('Total Listings')).toBeInTheDocument();
    expect(screen.getByText('Average APY')).toBeInTheDocument();
    expect(screen.getByText('Median Price')).toBeInTheDocument();
    
    // Check if values are rendered (relying on KPICard formatting count, currency, percentage)
    // 1542 might be formatted as 1.5K or 1,542.
    // 250 might be $250.00
    // 8.5 might be 8.5%
    expect(screen.getByText(/1542|1.5K/)).toBeInTheDocument();
    expect(screen.getByText(/8.5%/)).toBeInTheDocument();
    expect(screen.getByText(/\$250/)).toBeInTheDocument();
  });

  it('handles zero listings edge case correctly', async () => {
    vi.mocked(apiGet).mockResolvedValue({
      activeListings: 0,
      averageYield: 0,
      medianPrice: 0,
    });

    render(<MarketStatsBanner />);

    await waitFor(() => {
      expect(screen.getByLabelText('Market statistics')).toBeInTheDocument();
    });

    // Zero should still be rendered, not fall back to an empty string or error
    expect(screen.getAllByText(/0|0.0|0%/).length).toBeGreaterThan(0);
  });

  it('degrades gracefully on fetch error and supports retry', async () => {
    vi.mocked(apiGet).mockRejectedValue(new Error('Network timeout'));

    render(<MarketStatsBanner />);

    // Wait for the error UI
    await waitFor(() => {
      expect(screen.getByText('Market stats unavailable.')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    // Mock a successful retry
    vi.mocked(apiGet).mockResolvedValue({
      activeListings: 5,
      averageYield: 1.5,
      medianPrice: 50,
    });

    fireEvent.click(retryButton);

    // It should go back to loading, then success
    await waitFor(() => {
      expect(screen.getByLabelText('Market statistics')).toBeInTheDocument();
    });

    expect(screen.queryByText('Market stats unavailable.')).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledTimes(2);
  });
});
