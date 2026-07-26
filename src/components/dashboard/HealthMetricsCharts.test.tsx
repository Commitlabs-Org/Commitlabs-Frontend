// @vitest-environment jsdom
//
// RTL tests for the HealthMetrics value-history and drawdown chart components.
// Charts use recharts which renders SVGs; we stub recharts to keep tests fast
// and focused on the component's own logic (data flow, tooltip rendering).

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ── Mock recharts ──────────────────────────────────────────────────────────────
vi.mock('recharts', () => {
  const Passthrough: React.FC<{ children?: React.ReactNode; [k: string]: unknown }> = ({
    children,
  }) => <>{children}</>;
  return {
    LineChart: Passthrough,
    AreaChart: Passthrough,
    Line: () => null,
    Area: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: ({
      x,
      label,
    }: {
      x?: string;
      label?: { value?: string };
    }) => (
      <div data-testid={`ref-line-${x}`} aria-label={label?.value} />
    ),
    ResponsiveContainer: Passthrough,
  };
});

vi.mock('@/lib/a11y/useReducedMotion', () => ({ useReducedMotion: () => false }));

import { HealthMetricsValueHistoryChart } from './HealthMetricsValueHistoryChart';
import { HealthMetricsDrawdownChart } from './HealthMetricsDrawdownChart';

// ── Test data ──────────────────────────────────────────────────────────────────

const VALUE_DATA = [
  { date: 'Jan', currentValue: 50000, initialAmount: 50000 },
  { date: 'Feb', currentValue: 52000, initialAmount: 50000 },
  { date: 'Mar', currentValue: 54000, initialAmount: 50000 },
];

const DRAWDOWN_DATA = [
  { date: 'Jan', drawdownPercent: 0 },
  { date: 'Feb', drawdownPercent: 0.05 },
  { date: 'Mar', drawdownPercent: 0.12 },
];

// ── HealthMetricsValueHistoryChart ─────────────────────────────────────────────

describe('HealthMetricsValueHistoryChart', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(
      <HealthMetricsValueHistoryChart data={[]} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the descriptive text about tracking value over time', () => {
    render(<HealthMetricsValueHistoryChart data={VALUE_DATA} />);
    expect(screen.getByText(/track how your commitment value/i)).toBeInTheDocument();
  });

  it('does not render lifecycle event reference lines when no events provided', () => {
    render(<HealthMetricsValueHistoryChart data={VALUE_DATA} />);
    expect(screen.queryByTestId(/ref-line/)).not.toBeInTheDocument();
  });

  it('renders a reference line for each lifecycle event', () => {
    const events = [
      { date: 'Jan', label: 'Inception' },
      { date: 'Feb', label: 'Rebalance' },
    ];
    render(<HealthMetricsValueHistoryChart data={VALUE_DATA} lifecycleEvents={events} />);
    expect(screen.getByTestId('ref-line-Jan')).toBeInTheDocument();
    expect(screen.getByTestId('ref-line-Feb')).toBeInTheDocument();
  });

  it('reference lines carry the event label', () => {
    render(
      <HealthMetricsValueHistoryChart
        data={VALUE_DATA}
        lifecycleEvents={[{ date: 'Mar', label: 'Maturity' }]}
      />,
    );
    expect(screen.getByTestId('ref-line-Mar')).toHaveAttribute('aria-label', 'Maturity');
  });

  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(
      <HealthMetricsValueHistoryChart data={VALUE_DATA} volatilityPercent={45} />,
    );
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('does not render VolatilityExposureMeter when volatilityPercent is omitted', () => {
    render(<HealthMetricsValueHistoryChart data={VALUE_DATA} />);
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});

// ── HealthMetricsDrawdownChart ─────────────────────────────────────────────────

describe('HealthMetricsDrawdownChart', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(<HealthMetricsDrawdownChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the descriptive text about monitoring max loss', () => {
    render(<HealthMetricsDrawdownChart data={DRAWDOWN_DATA} />);
    expect(screen.getByText(/monitor the maximum loss/i)).toBeInTheDocument();
  });

  it('does not render lifecycle event lines when none provided', () => {
    render(<HealthMetricsDrawdownChart data={DRAWDOWN_DATA} />);
    expect(screen.queryByTestId(/ref-line/)).not.toBeInTheDocument();
  });

  it('renders reference lines for lifecycle events', () => {
    const events = [{ date: 'Feb', label: 'Alert' }];
    render(<HealthMetricsDrawdownChart data={DRAWDOWN_DATA} lifecycleEvents={events} />);
    expect(screen.getByTestId('ref-line-Feb')).toBeInTheDocument();
  });

  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(<HealthMetricsDrawdownChart data={DRAWDOWN_DATA} volatilityPercent={30} />);
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('does not render VolatilityExposureMeter when omitted', () => {
    render(<HealthMetricsDrawdownChart data={DRAWDOWN_DATA} />);
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});
