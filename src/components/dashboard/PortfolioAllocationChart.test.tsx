/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { PortfolioAllocationChartInner } from './PortfolioAllocationChart';

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

const baseCommitment = {
  id: '1',
  type: 'Safe' as const,
  status: 'Active' as const,
  asset: 'XLM',
  amount: '50000',
  currentValue: '52600',
  changePercent: 5.2,
  durationProgress: 87,
  daysRemaining: 12,
  complianceScore: 95,
  maxLoss: '2%',
  currentDrawdown: '0.8%',
  createdDate: '2026-01-10',
  expiryDate: '2026-02-09',
};

const mockCommitments = [
  { ...baseCommitment },
  {
    ...baseCommitment,
    id: '2',
    type: 'Balanced' as const,
    asset: 'BTC',
    amount: '30000',
  },
  {
    ...baseCommitment,
    id: '3',
    type: 'Aggressive' as const,
    asset: 'XLM',
    amount: '20000',
  },
];

describe('PortfolioAllocationChartInner', () => {
  it('renders with commitments', () => {
    const { container } = render(
      <PortfolioAllocationChartInner commitments={mockCommitments} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders empty state when no commitments', () => {
    render(<PortfolioAllocationChartInner commitments={[]} />);
    expect(screen.getByText('No Portfolio Data')).toBeTruthy();
    expect(
      screen.getByText(/create a commitment/i),
    ).toBeTruthy();
  });

  it('renders accessible table with allocation data', () => {
    render(
      <PortfolioAllocationChartInner commitments={mockCommitments} />,
    );
    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
    expect(table).toHaveAttribute(
      'aria-label',
      'Portfolio allocation by risk profile',
    );
  });

  it('shows risk profile categories by default', () => {
    render(
      <PortfolioAllocationChartInner commitments={mockCommitments} />,
    );
    expect(screen.getAllByText('Safe').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Balanced').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Aggressive').length).toBeGreaterThanOrEqual(1);
  });

  it('renders with a single commitment', () => {
    const single = [mockCommitments[0]!];
    const { container } = render(
      <PortfolioAllocationChartInner commitments={single} />,
    );
    expect(container.firstChild).toBeTruthy();
    expect(screen.getAllByText('Safe').length).toBeGreaterThanOrEqual(1);
  });
});
