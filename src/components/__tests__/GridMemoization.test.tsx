// @vitest-environment happy-dom
/**
 * Memoization regression tests for MyCommitmentsGrid and MarketplaceGrid.
 *
 * The grids must only re-render cards whose props actually changed. We assert
 * this with render-counting spies: the real card components are replaced with
 * lightweight `React.memo`-wrapped mocks that tally how many times each card's
 * render function runs, keyed by id. Filtering/sorting the list must not bump
 * the counter for cards that did not change.
 *
 * A separate suite imports the *real* card components and asserts they are
 * wrapped in `React.memo` and still render correctly.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { Commitment } from '@/types/commitment';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

// Hoisted render-count stores shared with the vi.mock factories below.
const { myCardRenders, marketplaceRenders } = vi.hoisted(() => ({
  myCardRenders: {} as Record<string, number>,
  marketplaceRenders: {} as Record<string, number>,
}));

vi.mock('@/components/MyCommitmentCard', async () => {
  const ReactMod = await import('react');
  const MockCard = ReactMod.memo(function MockMyCommitmentCard({
    commitment,
  }: {
    commitment: { id: string };
  }) {
    myCardRenders[commitment.id] = (myCardRenders[commitment.id] ?? 0) + 1;
    return ReactMod.createElement(
      'div',
      { 'data-testid': `my-card-${commitment.id}` },
      commitment.id,
    );
  });
  return { default: MockCard };
});

// CommitmentDetailsModal is a heavy, unrelated dependency of the real
// MarketplaceCard; stub it so importing the real card stays lightweight.
vi.mock('@/components/modals/CommitmentDetailsModal', () => ({
  CommitmentDetailsModal: () => null,
}));

vi.mock('@/components/MarketplaceCard', async () => {
  const ReactMod = await import('react');
  const MockCard = ReactMod.memo(function MockMarketplaceCard({
    id,
  }: {
    id: string;
  }) {
    marketplaceRenders[id] = (marketplaceRenders[id] ?? 0) + 1;
    return ReactMod.createElement(
      'div',
      { 'data-testid': `market-card-${id}` },
      id,
    );
  });
  return { MarketplaceCard: MockCard };
});

// Imported after the mocks are declared so the grids pick up the mocked cards.
import MyCommitmentsGrid from '@/components/MyCommitmentsGrid';
import { MarketplaceGrid } from '@/components/MarketplaceGrid';

// Stable callbacks shared across rerenders, mirroring the useCallback-stabilized
// handlers the real page passes down. If these changed identity per render,
// React.memo could not skip unchanged cards.
const noopDetails = (_id: string) => undefined;
const noopAttestations = (_id: string) => undefined;
const noopEarlyExit = (_id: string) => undefined;

function makeCommitment(id: string, overrides: Partial<Commitment> = {}): Commitment {
  return {
    id,
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    currentValue: '52,600',
    changePercent: 5.2,
    durationProgress: 75,
    daysRemaining: 15,
    complianceScore: 95,
    maxLoss: '2%',
    currentDrawdown: '0.8%',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026',
    ...overrides,
  };
}

function makeListing(id: string, overrides: Partial<MarketplaceCardProps> = {}): MarketplaceCardProps {
  return {
    id,
    type: 'Safe',
    score: 95,
    amount: '$50,000',
    duration: '25 days',
    yield: '5.2%',
    maxLoss: '2%',
    owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    price: '$52,000',
    forSale: true,
    ...overrides,
  };
}

function resetCounts(store: Record<string, number>) {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}

describe('MyCommitmentsGrid memoization', () => {
  beforeEach(() => resetCounts(myCardRenders));

  function renderGrid(commitments: Commitment[]) {
    return render(
      <MyCommitmentsGrid
        commitments={commitments}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );
  }

  it('renders one card per commitment with a stable id key', () => {
    const items = [makeCommitment('A'), makeCommitment('B'), makeCommitment('C')];
    renderGrid(items);

    // The count label is split across nodes (`<span>3</span> commitments found`).
    expect(screen.getByText('commitments found')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(myCardRenders).toEqual({ A: 1, B: 1, C: 1 });
  });

  it('does not re-render the surviving cards when one is filtered out', () => {
    const items = [makeCommitment('A'), makeCommitment('B'), makeCommitment('C')];
    const { rerender } = renderGrid(items);
    resetCounts(myCardRenders);

    // Simulate a filter that removes B; A and C keep their object identity.
    rerender(
      <MyCommitmentsGrid
        commitments={[items[0], items[2]]}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );

    expect(screen.queryByTestId('my-card-B')).toBeNull();
    expect(myCardRenders.A).toBeUndefined();
    expect(myCardRenders.C).toBeUndefined();
  });

  it('re-renders only the card whose data changed', () => {
    const items = [makeCommitment('A'), makeCommitment('B'), makeCommitment('C')];
    const { rerender } = renderGrid(items);
    resetCounts(myCardRenders);

    // Replace only B with a new object; A and C keep their identity.
    const nextB = makeCommitment('B', { amount: '999,999' });
    rerender(
      <MyCommitmentsGrid
        commitments={[items[0], nextB, items[2]]}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );

    expect(myCardRenders).toEqual({ B: 1 });
  });

  it('does not re-render any card on a sort-only reorder', () => {
    const items = [makeCommitment('A'), makeCommitment('B'), makeCommitment('C')];
    const { rerender } = renderGrid(items);
    resetCounts(myCardRenders);

    // Same object references, reordered.
    rerender(
      <MyCommitmentsGrid
        commitments={[items[2], items[0], items[1]]}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );

    expect(myCardRenders).toEqual({});
  });

  it('re-renders every card when all item references change', () => {
    const items = [makeCommitment('A'), makeCommitment('B'), makeCommitment('C')];
    const { rerender } = renderGrid(items);
    resetCounts(myCardRenders);

    const fresh = items.map((c) => ({ ...c }));
    rerender(
      <MyCommitmentsGrid
        commitments={fresh}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );

    expect(myCardRenders).toEqual({ A: 1, B: 1, C: 1 });
  });

  it('shows the empty state and renders no cards when results are empty', () => {
    renderGrid([]);

    expect(screen.getByText('commitments found')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(
      screen.getByText('No commitments found matching your filters.'),
    ).toBeInTheDocument();
    expect(myCardRenders).toEqual({});
  });
});

describe('MarketplaceGrid memoization', () => {
  beforeEach(() => resetCounts(marketplaceRenders));

  it('renders one card per listing', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    render(<MarketplaceGrid items={items} />);

    expect(marketplaceRenders).toEqual({ '001': 1, '002': 1, '003': 1 });
  });

  it('does not re-render surviving cards when one is filtered out', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    const { rerender } = render(<MarketplaceGrid items={items} />);
    resetCounts(marketplaceRenders);

    rerender(<MarketplaceGrid items={[items[0], items[2]]} />);

    expect(screen.queryByTestId('market-card-002')).toBeNull();
    expect(marketplaceRenders['001']).toBeUndefined();
    expect(marketplaceRenders['003']).toBeUndefined();
  });

  it('re-renders only the card whose data changed', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    const { rerender } = render(<MarketplaceGrid items={items} />);
    resetCounts(marketplaceRenders);

    const next002 = makeListing('002', { price: '$999,999' });
    rerender(<MarketplaceGrid items={[items[0], next002, items[2]]} />);

    expect(marketplaceRenders).toEqual({ '002': 1 });
  });

  it('does not re-render any card on a sort-only reorder', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    const { rerender } = render(<MarketplaceGrid items={items} />);
    resetCounts(marketplaceRenders);

    rerender(<MarketplaceGrid items={[items[2], items[0], items[1]]} />);

    expect(marketplaceRenders).toEqual({});
  });

  it('re-renders every card when every listing changes value', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    const { rerender } = render(<MarketplaceGrid items={items} />);
    resetCounts(marketplaceRenders);

    // MarketplaceCard receives spread primitive props, so a re-render happens
    // only when a value actually changes — not merely on a new object identity.
    const fresh = items.map((i) => ({ ...i, price: '$999,999' }));
    rerender(<MarketplaceGrid items={fresh} />);

    expect(marketplaceRenders).toEqual({ '001': 1, '002': 1, '003': 1 });
  });

  it('does not re-render cards when item objects are cloned without value changes', () => {
    const items = [makeListing('001'), makeListing('002'), makeListing('003')];
    const { rerender } = render(<MarketplaceGrid items={items} />);
    resetCounts(marketplaceRenders);

    // New object identities but identical primitive values -> memo skips them.
    const cloned = items.map((i) => ({ ...i }));
    rerender(<MarketplaceGrid items={cloned} />);

    expect(marketplaceRenders).toEqual({});
  });

  it('shows the empty state when there are no items', () => {
    render(<MarketplaceGrid items={[]} />);

    expect(screen.getByText('No commitments available')).toBeInTheDocument();
    expect(marketplaceRenders).toEqual({});
  });
});

describe('card components are wrapped in React.memo', () => {
  const memoType = Symbol.for('react.memo');

  it('MyCommitmentCard is a memo component and still renders', async () => {
    const actual = await vi.importActual<typeof import('@/components/MyCommitmentCard')>(
      '@/components/MyCommitmentCard',
    );
    const RealCard = actual.default as unknown as { $$typeof: symbol };
    expect(RealCard.$$typeof).toBe(memoType);

    const Card = actual.default;
    render(
      <Card
        commitment={makeCommitment('CMT-REAL', { status: 'Active' })}
        onDetails={noopDetails}
        onAttestations={noopAttestations}
        onEarlyExit={noopEarlyExit}
      />,
    );
    expect(screen.getByText('CMT-REAL')).toBeInTheDocument();
  });

  it('MarketplaceCard is a memo component and still renders', async () => {
    const actual = await vi.importActual<typeof import('@/components/MarketplaceCard')>(
      '@/components/MarketplaceCard',
    );
    const RealCard = actual.MarketplaceCard as unknown as { $$typeof: symbol };
    expect(RealCard.$$typeof).toBe(memoType);

    const Card = actual.MarketplaceCard;
    render(<Card {...makeListing('042', { forSale: false })} />);
    expect(screen.getByText('#CMT-042')).toBeInTheDocument();
  });
});
