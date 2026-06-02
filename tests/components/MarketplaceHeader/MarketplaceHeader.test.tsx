import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MarketplaceHeader } from '../../../src/components/MarketplaceHeader/MarketplaceHeader';

// Mock fetch for stats endpoint
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ activeListings: 12, averageYield: 5.2, medianPrice: 1500 }),
  })
) as jest.Mock;

describe('MarketplaceHeader', () => {
  test('renders stats after fetch', async () => {
    render(<MarketplaceHeader />);
    // Wait for stats to appear
    await waitFor(() => expect(screen.getByText(/Listings:/)).toBeInTheDocument());
    expect(screen.getByText(/Listings: 12/)).toBeInTheDocument();
    expect(screen.getByText(/Avg Yield: 5.2%/)).toBeInTheDocument();
    expect(screen.getByText(/Median Price: \$1500/)).toBeInTheDocument();
  });

  test('sort control changes value', () => {
    render(<MarketplaceHeader />);
    const select = screen.getByLabelText('Sort marketplace');
    fireEvent.change(select, { target: { value: 'priceLow' } });
    expect((select as HTMLSelectElement).value).toBe('priceLow');
  });
});
