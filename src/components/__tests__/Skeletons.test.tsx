/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MarketplaceGridSkeleton } from '@/components/MarketplaceGridSkeleton';
import MyCommitmentsGridSkeleton from '@/components/MyCommitmentsGridSkeleton';
import HealthMetricsSkeleton from '@/components/HealthMetricsSkeleton';

afterEach(() => cleanup());

// ─── MarketplaceGridSkeleton ───────────────────────────────────────────────────

describe('MarketplaceGridSkeleton', () => {
  it('renders the default 6 card placeholders', () => {
    render(<MarketplaceGridSkeleton />);
    const list = document.querySelector('ul');
    expect(list).not.toBeNull();
    expect(list!.querySelectorAll('li')).toHaveLength(6);
  });

  it('renders the correct number of cards when cardCount is overridden', () => {
    render(<MarketplaceGridSkeleton cardCount={3} />);
    const list = document.querySelector('ul');
    expect(list!.querySelectorAll('li')).toHaveLength(3);
  });

  it('has an accessible role=status label', () => {
    render(<MarketplaceGridSkeleton />);
    expect(screen.getByRole('status', { name: /loading marketplace listings/i })).toBeInTheDocument();
  });

  it('renders filters skeleton when showFilters is true (default)', () => {
    const { container } = render(<MarketplaceGridSkeleton showFilters={true} />);
    // FiltersSkeleton renders 5 Skeleton children; confirm its wrapper is present
    const filterSkeletonItems = container.querySelectorAll('[aria-label="Loading marketplace listings"] .flex.flex-wrap');
    expect(filterSkeletonItems.length).toBeGreaterThan(0);
  });

  it('does not render filter section when showFilters is false', () => {
    const { container } = render(<MarketplaceGridSkeleton showFilters={false} />);
    const filterSkeletonItems = container.querySelectorAll('[aria-label="Loading marketplace listings"] .flex.flex-wrap');
    expect(filterSkeletonItems.length).toBe(0);
  });

  it('contains no interactive elements', () => {
    const { container } = render(<MarketplaceGridSkeleton />);
    const interactive = container.querySelectorAll('button, a, input, select, textarea');
    expect(interactive.length).toBe(0);
  });
});

// ─── MyCommitmentsGridSkeleton ─────────────────────────────────────────────────

describe('MyCommitmentsGridSkeleton', () => {
  it('renders the default 6 card placeholders', () => {
    const { container } = render(<MyCommitmentsGridSkeleton />);
    // CommitmentCardSkeleton renders direct children of the grid div
    const grid = container.querySelector('.grid');
    expect(grid).not.toBeNull();
    // Each CommitmentCardSkeleton is a direct div child of the grid
    expect(grid!.children).toHaveLength(6);
  });

  it('renders the correct number of cards when cardCount is overridden', () => {
    const { container } = render(<MyCommitmentsGridSkeleton cardCount={4} />);
    const grid = container.querySelector('.grid');
    expect(grid!.children).toHaveLength(4);
  });

  it('has an accessible role=status label', () => {
    render(<MyCommitmentsGridSkeleton />);
    expect(screen.getByRole('status', { name: /loading commitments/i })).toBeInTheDocument();
  });

  it('renders stats section when showStats is true (default)', () => {
    const { container } = render(<MyCommitmentsGridSkeleton showStats={true} />);
    // CommitmentStatsSkeleton renders a grid of 4 stat cards
    const statGrids = container.querySelectorAll('.grid.grid-cols-2');
    expect(statGrids.length).toBeGreaterThan(0);
    expect(statGrids[0].children).toHaveLength(4);
  });

  it('does not render stats section when showStats is false', () => {
    const { container } = render(<MyCommitmentsGridSkeleton showStats={false} showFilters={false} />);
    // Without stats and filters, only the count placeholder + grid should remain
    const statGrids = container.querySelectorAll('.grid.grid-cols-2');
    // The only remaining grid should be the card grid (grid-cols-3)
    expect(statGrids.length).toBe(0);
  });

  it('contains no interactive elements', () => {
    const { container } = render(<MyCommitmentsGridSkeleton />);
    const interactive = container.querySelectorAll('button, a, input, select, textarea');
    expect(interactive.length).toBe(0);
  });
});

// ─── HealthMetricsSkeleton ─────────────────────────────────────────────────────

describe('HealthMetricsSkeleton', () => {
  it('renders exactly 1 chart placeholder by default', () => {
    const { container } = render(<HealthMetricsSkeleton />);
    // HealthChartSkeleton is a bg-[#111] border rounded-xl card
    // The metrics grid also has similar cards; select chart skeletons specifically
    // They are the direct children of the space-y-8 wrapper
    const chartWrapper = container.querySelector('.space-y-8');
    expect(chartWrapper).not.toBeNull();
    expect(chartWrapper!.children).toHaveLength(1);
  });

  it('renders the correct number of charts when chartCount is overridden', () => {
    const { container } = render(<HealthMetricsSkeleton chartCount={3} />);
    const chartWrapper = container.querySelector('.space-y-8');
    expect(chartWrapper!.children).toHaveLength(3);
  });

  it('renders 4 metric stat placeholders', () => {
    const { container } = render(<HealthMetricsSkeleton />);
    // Additional metrics grid is grid-cols-2 md:grid-cols-4
    const metricsGrid = container.querySelector('.grid.grid-cols-2');
    expect(metricsGrid).not.toBeNull();
    expect(metricsGrid!.children).toHaveLength(4);
  });

  it('has an accessible role=status label', () => {
    render(<HealthMetricsSkeleton />);
    expect(screen.getByRole('status', { name: /loading health metrics/i })).toBeInTheDocument();
  });

  it('renders 4 tab placeholders when showTabs is true (default)', () => {
    const { container } = render(<HealthMetricsSkeleton showTabs={true} />);
    // Tabs are rendered from ['value', 'drawdown', 'fee', 'compliance']
    const tabsWrapper = container.querySelector('.flex.flex-wrap.gap-2');
    expect(tabsWrapper).not.toBeNull();
    expect(tabsWrapper!.children).toHaveLength(4);
  });

  it('does not render tabs when showTabs is false', () => {
    const { container } = render(<HealthMetricsSkeleton showTabs={false} />);
    const tabsWrapper = container.querySelector('.flex.flex-wrap.gap-2');
    expect(tabsWrapper).toBeNull();
  });

  it('contains no interactive elements', () => {
    const { container } = render(<HealthMetricsSkeleton />);
    const interactive = container.querySelectorAll('button, a, input, select, textarea');
    expect(interactive.length).toBe(0);
  });
});
