/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.mock('recharts', () => {
  const Passthrough: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
  return {
    LineChart: Passthrough,
    AreaChart: Passthrough,
    BarChart: Passthrough,
    Line: () => null,
    Area: () => null,
    Bar: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    Legend: ({ content }: { content?: () => React.ReactNode }) => (
      <div data-testid="chart-legend">{typeof content === 'function' ? content() : null}</div>
    ),
    ReferenceLine: () => null,
    ResponsiveContainer: Passthrough,
  };
});

vi.mock('../../lib/a11y/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

import { HealthMetricsComplianceChart } from './HealthMetricsComplianceChart';
import { HealthMetricsValueHistoryChart } from './HealthMetricsValueHistoryChart';
import { HealthMetricsDrawdownChart } from './HealthMetricsDrawdownChart';
import { HealthMetricsFeeGenerationChart } from './HealthMetricsFeeGenerationChart';
import {
  CHART_COLORS,
  CHART_GRID_PROPS,
  CHART_X_AXIS_PROPS,
  formatLocaleNumber,
} from './chartConfig';

const MEMO_SYMBOL = Symbol.for('react.memo');

const COMPLIANCE_DATA = [
  { date: '2026-01-01', complianceScore: 80 },
  { date: '2026-01-02', complianceScore: 92 },
];

describe('chartConfig', () => {
  it('exports stable shared axis/grid chrome', () => {
    expect(CHART_GRID_PROPS.vertical).toBe(false);
    expect(CHART_GRID_PROPS.stroke).toBe(CHART_COLORS.grid);
    expect(CHART_X_AXIS_PROPS.dataKey).toBe('date');
    expect(formatLocaleNumber(1200)).toBe((1200).toLocaleString());
  });
});

describe('Health Metrics chart memoization', () => {
  it('wraps each chart export in React.memo', () => {
    expect((HealthMetricsComplianceChart as unknown as { $$typeof: symbol }).$$typeof).toBe(
      MEMO_SYMBOL,
    );
    expect((HealthMetricsValueHistoryChart as unknown as { $$typeof: symbol }).$$typeof).toBe(
      MEMO_SYMBOL,
    );
    expect((HealthMetricsDrawdownChart as unknown as { $$typeof: symbol }).$$typeof).toBe(
      MEMO_SYMBOL,
    );
    expect((HealthMetricsFeeGenerationChart as unknown as { $$typeof: symbol }).$$typeof).toBe(
      MEMO_SYMBOL,
    );
  });

  it('does not re-render a memoized chart when unrelated parent state changes', () => {
    type MemoComponent = React.MemoExoticComponent<React.FC<{ data: typeof COMPLIANCE_DATA }>>;
    const MemoChart = HealthMetricsComplianceChart as MemoComponent;
    const OriginalType = MemoChart.type;

    let renderCount = 0;
    MemoChart.type = ((props: { data: typeof COMPLIANCE_DATA }) => {
      renderCount += 1;
      return OriginalType(props);
    }) as typeof OriginalType;

    function Parent({ tick }: { tick: number }) {
      return (
        <div>
          <span data-testid="parent-tick">{tick}</span>
          <HealthMetricsComplianceChart data={COMPLIANCE_DATA} />
        </div>
      );
    }

    const { rerender } = render(<Parent tick={0} />);
    expect(renderCount).toBe(1);
    expect(screen.getByTestId('parent-tick')).toHaveTextContent('0');
    expect(screen.getByText(/historical compliance score/i)).toBeInTheDocument();

    rerender(<Parent tick={1} />);
    expect(screen.getByTestId('parent-tick')).toHaveTextContent('1');
    // Same props reference → React.memo skips the chart body.
    expect(renderCount).toBe(1);

    rerender(<Parent tick={2} />);
    expect(renderCount).toBe(1);

    MemoChart.type = OriginalType;
  });

  it('re-renders when chart data identity changes', () => {
    type MemoComponent = React.MemoExoticComponent<React.FC<{ data: typeof COMPLIANCE_DATA }>>;
    const MemoChart = HealthMetricsComplianceChart as MemoComponent;
    const OriginalType = MemoChart.type;

    let renderCount = 0;
    MemoChart.type = ((props: { data: typeof COMPLIANCE_DATA }) => {
      renderCount += 1;
      return OriginalType(props);
    }) as typeof OriginalType;

    const first = [...COMPLIANCE_DATA];
    const { rerender } = render(<HealthMetricsComplianceChart data={first} />);
    expect(renderCount).toBe(1);

    const second = [...COMPLIANCE_DATA];
    rerender(<HealthMetricsComplianceChart data={second} />);
    expect(renderCount).toBe(2);

    MemoChart.type = OriginalType;
  });
});
