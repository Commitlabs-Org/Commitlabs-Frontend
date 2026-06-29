// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarketplaceGrid } from '../../src/components/MarketplaceGrid';
import { MarketplaceGridSkeleton } from '../../src/components/MarketplaceGridSkeleton';
import { makeMarketplaceCard } from '../fixtures';

vi.mock('../../src/components/modals/CommitmentDetailsModal', () => ({
  CommitmentDetailsModal: () => null,
}));

const listings = [
  makeMarketplaceCard({
    id: '7',
    type: 'Balanced',
    score: 91,
    amount: '$10,000',
    duration: '45 days',
    yield: '8.2%',
    maxLoss: '12%',
    owner: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    price: '$1,250',
    forSale: true,
  }),
  makeMarketplaceCard({
    id: '8',
    type: 'Safe',
    score: 87,
    amount: '$5,000',
    duration: '30 days',
    yield: '4.5%',
    maxLoss: '5%',
    owner: 'GSHORT',
    price: '$900',
    forSale: false,
  }),
];

describe('MarketplaceGrid', () => {
  it('renders marketplace listing cards with trade and unavailable states', () => {
    render(<MarketplaceGrid items={listings} />);

    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(grid).getByRole('article', { name: /commitment 7/i })).toBeInTheDocument();
    expect(within(grid).getByRole('article', { name: /commitment 8/i })).toBeInTheDocument();
    expect(screen.getByText('#CMT-007')).toBeInTheDocument();
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trade 7/i })).toBeInTheDocument();
    expect(screen.getByText('Not for sale')).toBeInTheDocument();
  });

  it('renders an empty state when no listings match the filters', () => {
    render(<MarketplaceGrid items={[]} />);

    expect(screen.getByRole('region', { name: /marketplace listings/i })).toBeInTheDocument();
    expect(screen.getByText('No commitments available')).toBeInTheDocument();
    expect(
      screen.getByText('New offers will appear here once they are listed.'),
    ).toBeInTheDocument();
  });

  it('renders the marketplace loading skeleton with the requested card count', () => {
    render(<MarketplaceGridSkeleton showFilters={false} cardCount={3} />);

    expect(screen.getByRole('status', { name: /loading marketplace listings/i })).toBeInTheDocument();
    const skeletonGrid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(skeletonGrid).getAllByRole('listitem')).toHaveLength(3);
  });
});
