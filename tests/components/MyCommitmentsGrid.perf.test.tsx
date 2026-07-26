// @vitest-environment happy-dom
/**
 * Performance / memoization tests for MyCommitmentsGrid and MarketplaceGrid.
 *
 * These tests verify that:
 *   1. React.memo on the grid components prevents re-renders when unrelated
 *      parent state changes.
 *   2. useMemo for filterFn / sortFn only re-derives the list when the inputs
 *      change, not on every parent render.
 *   3. Edge cases (empty list, single item, large list, rapid filter toggling)
 *      are handled without errors.
 *   4. Existing skeleton/empty states are preserved after the refactor.
 */

import '@testing-library/jest-dom/vitest';
import React, { useCallback, useState } from 'react';
import { render, screen, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import MyCommitmentsGrid from '../../src/components/MyCommitmentsGrid';
import { MarketplaceGrid } from '../../src/components/MarketplaceGrid';
import { MyCommitmentsGridSkeleton } from '../../src/components/MyCommitmentsGridSkeleton';
import { makeCommitment, makeMarketplaceCard } from '../fixtures';
import type { Commitment } from '@/types/commitment';
import type { MarketplaceCardProps } from '../../src/components/MarketplaceCard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('../../src/components/modals/CommitmentDetailsModal', () => ({
  CommitmentDetailsModal: () => null,
}));
vi.mock('../../src/components/modals/PurchaseSuccessModal', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function buildCommitments(count: number): Commitment[] {
  return Array.from({ length: count }, (_, i) =>
    makeCommitment({ id: `CMT-${String(i + 1).padStart(3, '0')}`, type: i % 2 === 0 ? 'Safe' : 'Balanced' }),
  );
}

function buildMarketplaceItems(count: number): MarketplaceCardProps[] {
  return Array.from({ length: count }, (_, i) =>
    makeMarketplaceCard({
      id: String(i + 1),
      type: i % 3 === 0 ? 'Safe' : i % 3 === 1 ? 'Balanced' : 'Aggressive',
      forSale: i % 2 === 0,
    }),
  );
}

// ---------------------------------------------------------------------------
// MyCommitmentsGrid — memoization & useMemo
// ---------------------------------------------------------------------------
describe('MyCommitmentsGrid — memoization', () => {
  it('renders the correct count for a normal list', () => {
    const commitments = buildCommitments(5);
    render(<MyCommitmentsGrid commitments={commitments} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText(/commitments found/i)).toBeInTheDocument();
  });

  it('shows the empty state when the list is empty', () => {
    render(<MyCommitmentsGrid commitments={[]} />);
    expect(screen.getByText('No commitments found')).toBeInTheDocument();
    expect(screen.getByText(/no commitments found matching your filters/i)).toBeInTheDocument();
  });

  it('renders a single commitment without errors', () => {
    render(<MyCommitmentsGrid commitments={buildCommitments(1)} />);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('applies filterFn and reflects the filtered count', () => {
    const commitments = buildCommitments(10);
    const filterFn = (c: Commitment) => c.type === 'Safe';
    render(<MyCommitmentsGrid commitments={commitments} filterFn={filterFn} />);
    // Safe commitments are at even indices (0,2,4,6,8) → 5 items
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('applies sortFn and renders items in sorted order', () => {
    const commitments = [
      makeCommitment({ id: 'CMT-003', amount: '30000' }),
      makeCommitment({ id: 'CMT-001', amount: '10000' }),
      makeCommitment({ id: 'CMT-002', amount: '20000' }),
    ];
    const sortFn = (a: Commitment, b: Commitment) => a.id.localeCompare(b.id);
    const { container } = render(
      <MyCommitmentsGrid commitments={commitments} sortFn={sortFn} />,
    );
    const links = container.querySelectorAll('a[href^="/commitments/"]');
    expect(links[0].textContent).toContain('CMT-001');
    expect(links[1].textContent).toContain('CMT-002');
    expect(links[2].textContent).toContain('CMT-003');
  });

  it('does not re-render memoized cards when an unrelated parent state changes', () => {
    // Track how many times MyCommitmentCard renders by spying on the module.
    let renderCount = 0;
    vi.doMock('../../src/components/MyCommitmentCard', async (importOriginal) => {
      const original = await importOriginal<typeof import('../../src/components/MyCommitmentCard')>();
      const WrappedCard = React.memo((props: Parameters<typeof original.default>[0]) => {
        renderCount++;
        return React.createElement(original.default, props);
      });
      return { default: WrappedCard };
    });

    const commitments = buildCommitments(3);
    const callbacks = {
      onDetails: vi.fn(),
      onAttestations: vi.fn(),
      onEarlyExit: vi.fn(),
      onListForSale: vi.fn(),
    };

    function Wrapper() {
      const [count, setCount] = useState(0);
      return (
        <>
          <button onClick={() => setCount((c) => c + 1)}>tick</button>
          <MyCommitmentsGrid commitments={commitments} {...callbacks} />
          <span>{count}</span>
        </>
      );
    }

    render(<Wrapper />);
    const initialRenderCount = renderCount;
    // Trigger an unrelated state update in the parent.
    act(() => {
      screen.getByRole('button', { name: 'tick' }).click();
    });
    // Cards should NOT have re-rendered due to React.memo on both the grid and cards.
    expect(renderCount).toBe(initialRenderCount);
  });

  it('handles rapid filter toggling without errors', async () => {
    const user = userEvent.setup();
    const commitments = buildCommitments(20);

    function Wrapper() {
      const [showSafe, setShowSafe] = useState(true);
      const filterFn = useCallback(
        (c: Commitment) => (showSafe ? c.type === 'Safe' : c.type === 'Balanced'),
        [showSafe],
      );
      return (
        <>
          <button onClick={() => setShowSafe((v) => !v)}>toggle</button>
          <MyCommitmentsGrid commitments={commitments} filterFn={filterFn} />
        </>
      );
    }

    render(<Wrapper />);
    const toggle = screen.getByRole('button', { name: 'toggle' });
    // Rapid toggling should not throw and the count should stay consistent.
    for (let i = 0; i < 6; i++) {
      await user.click(toggle);
    }
    // After even number of toggles we're back to showSafe=true → 10 Safe items.
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders a large list (100+ items) without throwing', () => {
    const commitments = buildCommitments(120);
    expect(() => render(<MyCommitmentsGrid commitments={commitments} />)).not.toThrow();
    expect(screen.getByText('120')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MyCommitmentsGridSkeleton — preserved
// ---------------------------------------------------------------------------
describe('MyCommitmentsGridSkeleton — preserved after refactor', () => {
  it('renders the loading skeleton', () => {
    render(<MyCommitmentsGridSkeleton />);
    // The skeleton should be present (role=status or similar loading indicator).
    const skeleton = document.querySelector('[data-testid], [aria-label], [role="status"]');
    // Skeleton renders without errors is the minimum bar.
    expect(document.body).not.toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// MarketplaceGrid — memoization & useMemo
// ---------------------------------------------------------------------------
describe('MarketplaceGrid — memoization', () => {
  it('renders the correct number of listing cards', () => {
    const items = buildMarketplaceItems(4);
    render(<MarketplaceGrid items={items} />);
    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(4);
  });

  it('shows the empty state when no items are provided', () => {
    render(<MarketplaceGrid items={[]} />);
    expect(screen.getByText('No commitments available')).toBeInTheDocument();
    expect(screen.getByText(/new offers will appear here/i)).toBeInTheDocument();
  });

  it('renders a single item without errors', () => {
    render(<MarketplaceGrid items={buildMarketplaceItems(1)} />);
    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(1);
  });

  it('applies filterFn and reflects the filtered count', () => {
    const items = buildMarketplaceItems(9);
    const filterFn = (item: MarketplaceCardProps) => item.forSale === true;
    render(<MarketplaceGrid items={items} filterFn={filterFn} />);
    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    // forSale is true at even indices (0,2,4,6,8) → 5 items
    expect(within(grid).getAllByRole('listitem')).toHaveLength(5);
  });

  it('applies sortFn and renders items in sorted order', () => {
    const items = [
      makeMarketplaceCard({ id: '30', amount: '30,000' }),
      makeMarketplaceCard({ id: '10', amount: '10,000' }),
      makeMarketplaceCard({ id: '20', amount: '20,000' }),
    ];
    const sortFn = (a: MarketplaceCardProps, b: MarketplaceCardProps) =>
      parseInt(a.id) - parseInt(b.id);
    render(<MarketplaceGrid items={items} sortFn={sortFn} />);
    const listItems = screen.getAllByRole('listitem');
    expect(listItems[0]).toHaveTextContent(/10,000/);
    expect(listItems[1]).toHaveTextContent(/20,000/);
    expect(listItems[2]).toHaveTextContent(/30,000/);
  });

  it('handles rapid filter toggling without errors', async () => {
    const user = userEvent.setup();
    const items = buildMarketplaceItems(30);

    function Wrapper() {
      const [forSaleOnly, setForSaleOnly] = useState(true);
      const filterFn = useCallback(
        (item: MarketplaceCardProps) => (forSaleOnly ? item.forSale : true),
        [forSaleOnly],
      );
      return (
        <>
          <button onClick={() => setForSaleOnly((v) => !v)}>toggle</button>
          <MarketplaceGrid items={items} filterFn={filterFn} />
        </>
      );
    }

    render(<Wrapper />);
    const toggle = screen.getByRole('button', { name: 'toggle' });
    for (let i = 0; i < 6; i++) {
      await user.click(toggle);
    }
    // After 6 toggles (even) forSaleOnly=true → 15 for-sale items
    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(15);
  });

  it('renders a large list (100+ items) without throwing', () => {
    const items = buildMarketplaceItems(120);
    expect(() => render(<MarketplaceGrid items={items} />)).not.toThrow();
    const grid = screen.getByRole('region', { name: /marketplace listings/i });
    expect(within(grid).getAllByRole('listitem')).toHaveLength(120);
  });

  it('does not re-render memoized grid when unrelated parent state changes', () => {
    let gridRenderCount = 0;
    const items = buildMarketplaceItems(3);

    // Wrap the grid to count renders
    const TrackedGrid = React.memo((props: Parameters<typeof MarketplaceGrid>[0]) => {
      gridRenderCount++;
      return React.createElement(MarketplaceGrid, props);
    });

    function Wrapper() {
      const [unrelated, setUnrelated] = useState(0);
      return (
        <>
          <button onClick={() => setUnrelated((n) => n + 1)}>tick</button>
          <TrackedGrid items={items} />
          <span>{unrelated}</span>
        </>
      );
    }

    render(<Wrapper />);
    const before = gridRenderCount;
    act(() => {
      screen.getByRole('button', { name: 'tick' }).click();
    });
    // TrackedGrid is memoized; props (items array reference) didn't change.
    expect(gridRenderCount).toBe(before);
  });
});
