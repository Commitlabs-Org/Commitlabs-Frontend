// @vitest-environment happy-dom

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarketplaceHeader } from './MarketplaceHeader';
import { apiRequest } from '@/lib/client/apiClient';

vi.mock('@/lib/client/apiClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/client/apiClient')>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

// MarketStatsBanner makes its own independent API call (via @/lib/apiClient);
// it's unrelated to the search placeholder under test here, so it's stubbed out.
vi.mock('./MarketStatsBanner', () => ({
  MarketStatsBanner: () => null,
}));

describe('MarketplaceHeader search placeholder', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockResolvedValue({ activeListings: 0, averageYield: 0, medianPrice: 0 });
  });

  it('renders the search input with the correctly encoded default placeholder', async () => {
    render(<MarketplaceHeader />);

    const input = await screen.findByRole('combobox', { name: 'Search commitments' });
    expect(input).toHaveAttribute('placeholder', 'Search commitments…');
  });

  it('does not render the historical mojibake-corrupted placeholder', async () => {
    render(<MarketplaceHeader />);

    const input = await screen.findByRole('combobox', { name: 'Search commitments' });
    expect(input.getAttribute('placeholder')).not.toContain('â€¦');
  });

  it('respects a caller-provided searchPlaceholder override instead of the default', async () => {
    render(<MarketplaceHeader searchPlaceholder="Find a commitment" />);

    const input = await screen.findByRole('combobox', { name: 'Search commitments' });
    expect(input).toHaveAttribute('placeholder', 'Find a commitment');
  });
});
