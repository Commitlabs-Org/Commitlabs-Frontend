// @vitest-environment happy-dom

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CompareTray } from '@/components/marketplace/CompareTray';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

vi.mock('@/components/TrustBadge', () => ({
  TrustBadge: ({ level }: { level: string }) =>
    React.createElement('span', { 'data-testid': 'trust-badge' }, level),
}));

const LISTING_A: MarketplaceCardProps = {
  id: '001',
  type: 'Safe',
  score: 95,
  amount: '$50,000',
  duration: '25 days',
  yield: '5.2%',
  maxLoss: '2%',
  owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  price: '$52,000',
  forSale: true,
  trustLevel: 'verified',
};

const LISTING_B: MarketplaceCardProps = {
  id: '002',
  type: 'Balanced',
  score: 88,
  amount: '$100,000',
  duration: '45 days',
  yield: '12.5%',
  maxLoss: '8%',
  owner: '0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199',
  price: '$105,000',
  forSale: true,
  trustLevel: 'reputable',
};

describe('CompareTray', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when no listings are pinned', () => {
    const { container } = render(
      <CompareTray listings={[]} onRemove={vi.fn()} onClear={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows pinned count and listing chips', () => {
    render(
      <CompareTray
        listings={[LISTING_A]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole('region', { name: 'Compare listings tray' })).toBeTruthy();
    expect(screen.getByText('1 of 3 selected for compare')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Remove #CMT-001/i })).toBeTruthy();
  });

  it('disables Compare until at least two listings are pinned', () => {
    render(
      <CompareTray
        listings={[LISTING_A]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Open side-by-side comparison' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('opens comparison view when Compare is clicked with two listings', () => {
    render(
      <CompareTray
        listings={[LISTING_A, LISTING_B]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open side-by-side comparison' }));
    expect(screen.getByRole('dialog', { name: /Compare Listings/i })).toBeTruthy();
    expect(screen.getByText('Yield (APY)')).toBeTruthy();
    expect(screen.getByText('5.2%')).toBeTruthy();
    expect(screen.getByText('12.5%')).toBeTruthy();
  });

  it('auto-opens comparison view once for restored share URLs', async () => {
    render(
      <CompareTray
        listings={[LISTING_A, LISTING_B]}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        openOnRestore
      />,
    );

    expect(
      await screen.findByRole('dialog', { name: /Compare Listings/i }),
    ).toBeTruthy();
  });

  it('calls onClear when Clear or Dismiss is clicked', () => {
    const onClear = vi.fn();
    render(
      <CompareTray
        listings={[LISTING_A]}
        onRemove={vi.fn()}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear all pinned listings' }));
    expect(onClear).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss compare tray' }));
    expect(onClear).toHaveBeenCalledTimes(2);
  });

  it('calls onRemove when a chip remove button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <CompareTray
        listings={[LISTING_A, LISTING_B]}
        onRemove={onRemove}
        onClear={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Remove #CMT-001/i }));
    expect(onRemove).toHaveBeenCalledWith('001');
  });
});
