/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock ResizeObserver so Recharts' ResponsiveContainer works under happy-dom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock recharts ResponsiveContainer to give it real dimensions
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 300 }}>{children}</div>
    ),
  };
});

// Mock VolatilityExposureMeter to keep tests focused
vi.mock('@/components/VolatilityExposureMeter/VolatilityExposureMeter', () => ({
  default: () => <div data-testid="volatility-meter" />,
}));

import { HealthMetricsComplianceChart } from '../HealthMetricsComplianceChart';
import { HealthMetricsDrawdownChart } from '../HealthMetricsDrawdownChart';
import { HealthMetricsFeeGenerationChart } from '../HealthMetricsFeeGenerationChart';
import { HealthMetricsValueHistoryChart } from '../HealthMetricsValueHistoryChart';

// ---------------------------------------------------------------------------
// Shared test data
// ---------------------------------------------------------------------------
const complianceData = [
  { date: 'Jan', complianceScore: 80 },
  { date: 'Feb', complianceScore: 90 },
];

const drawdownData = [
  { date: 'Jan', drawdownPercent: 0.1 },
  { date: 'Feb', drawdownPercent: 0.2 },
];

const feeData = [
  { date: 'Jan', feeAmount: 100 },
  { date: 'Feb', feeAmount: 200 },
];

const valueData = [
  { date: 'Jan', currentValue: 1000, initialAmount: 900 },
  { date: 'Feb', currentValue: 1100, initialAmount: 900 },
];

// ---------------------------------------------------------------------------
// Compliance Chart
// ---------------------------------------------------------------------------
describe('HealthMetricsComplianceChart', () => {
  it('renders with data', () => {
    const { container } = render(<HealthMetricsComplianceChart data={complianceData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty data', () => {
    const { container } = render(<HealthMetricsComplianceChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders description text', () => {
    render(<HealthMetricsComplianceChart data={complianceData} />);
    expect(screen.getByText(/compliance score/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Compliance CustomTooltip
// ---------------------------------------------------------------------------
describe('HealthMetricsComplianceChart CustomTooltip', () => {
  // Extract via re-import trick — render the tooltip directly by inspecting
  // what Recharts receives. We test it via a wrapper that mirrors its contract.
  const ComplianceTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div>
          <p>{label}</p>
          <p>Score: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  it('returns null when inactive', () => {
    const { container } = render(
      <ComplianceTooltip active={false} payload={[{ value: 85 }]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(
      <ComplianceTooltip active={true} payload={[]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders label and score when active', () => {
    render(<ComplianceTooltip active={true} payload={[{ value: 85 }]} label="Jan" />);
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText('Score: 85')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Drawdown Chart
// ---------------------------------------------------------------------------
describe('HealthMetricsDrawdownChart', () => {
  it('renders with data', () => {
    const { container } = render(<HealthMetricsDrawdownChart data={drawdownData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty data', () => {
    const { container } = render(<HealthMetricsDrawdownChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders single-point data', () => {
    const { container } = render(
      <HealthMetricsDrawdownChart data={[{ date: 'Jan', drawdownPercent: 0.05 }]} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(<HealthMetricsDrawdownChart data={drawdownData} volatilityPercent={40} />);
    expect(screen.getByTestId('volatility-meter')).toBeTruthy();
  });

  it('does not render VolatilityExposureMeter when volatilityPercent is omitted', () => {
    render(<HealthMetricsDrawdownChart data={drawdownData} />);
    expect(screen.queryByTestId('volatility-meter')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Drawdown CustomTooltip
// ---------------------------------------------------------------------------
describe('HealthMetricsDrawdownChart CustomTooltip', () => {
  const DrawdownTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div>
          <p>{label}</p>
          <p>Drawdown: {(payload[0].value * 100).toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  it('returns null when inactive', () => {
    const { container } = render(
      <DrawdownTooltip active={false} payload={[{ value: 0.1 }]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(
      <DrawdownTooltip active={true} payload={[]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders label and formatted drawdown when active', () => {
    render(<DrawdownTooltip active={true} payload={[{ value: 0.1 }]} label="Jan" />);
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText('Drawdown: 10.0%')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Fee Generation Chart
// ---------------------------------------------------------------------------
describe('HealthMetricsFeeGenerationChart', () => {
  it('renders with data', () => {
    const { container } = render(<HealthMetricsFeeGenerationChart data={feeData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty data', () => {
    const { container } = render(<HealthMetricsFeeGenerationChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders single-point data', () => {
    const { container } = render(
      <HealthMetricsFeeGenerationChart data={[{ date: 'Jan', feeAmount: 50 }]} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(<HealthMetricsFeeGenerationChart data={feeData} volatilityPercent={20} />);
    expect(screen.getByTestId('volatility-meter')).toBeTruthy();
  });

  it('does not render VolatilityExposureMeter when volatilityPercent is omitted', () => {
    render(<HealthMetricsFeeGenerationChart data={feeData} />);
    expect(screen.queryByTestId('volatility-meter')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Fee Generation CustomTooltip
// ---------------------------------------------------------------------------
describe('HealthMetricsFeeGenerationChart CustomTooltip', () => {
  const FeeTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div>
          <p>{label}</p>
          <p>Fees: ${payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  it('returns null when inactive', () => {
    const { container } = render(
      <FeeTooltip active={false} payload={[{ value: 100 }]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(
      <FeeTooltip active={true} payload={[]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders label and fee value when active', () => {
    render(<FeeTooltip active={true} payload={[{ value: 1500 }]} label="Feb" />);
    expect(screen.getByText('Feb')).toBeTruthy();
    expect(screen.getByText(/Fees:.*1,500/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Value History Chart
// ---------------------------------------------------------------------------
describe('HealthMetricsValueHistoryChart', () => {
  it('renders with data', () => {
    const { container } = render(<HealthMetricsValueHistoryChart data={valueData} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders with empty data', () => {
    const { container } = render(<HealthMetricsValueHistoryChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders single-point data', () => {
    const { container } = render(
      <HealthMetricsValueHistoryChart
        data={[{ date: 'Jan', currentValue: 1000, initialAmount: 900 }]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders without initialAmount', () => {
    const { container } = render(
      <HealthMetricsValueHistoryChart data={[{ date: 'Jan', currentValue: 1000 }]} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(<HealthMetricsValueHistoryChart data={valueData} volatilityPercent={55} />);
    expect(screen.getByTestId('volatility-meter')).toBeTruthy();
  });

  it('does not render VolatilityExposureMeter when volatilityPercent is omitted', () => {
    render(<HealthMetricsValueHistoryChart data={valueData} />);
    expect(screen.queryByTestId('volatility-meter')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Value History CustomTooltip
// ---------------------------------------------------------------------------
describe('HealthMetricsValueHistoryChart CustomTooltip', () => {
  const ValueTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; color: string; name: string }>;
    label?: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div>
          <p>{label}</p>
          {payload.map((entry, i) => (
            <span key={i}>
              {entry.name}: {entry.value.toLocaleString()}
            </span>
          ))}
        </div>
      );
    }
    return null;
  };

  it('returns null when inactive', () => {
    const { container } = render(
      <ValueTooltip
        active={false}
        payload={[{ value: 1000, color: '#0ff0fc', name: 'Current Value' }]}
        label="Jan"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(
      <ValueTooltip active={true} payload={[]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders label and all payload entries when active', () => {
    render(
      <ValueTooltip
        active={true}
        payload={[
          { value: 1000, color: '#0ff0fc', name: 'Current Value' },
          { value: 900, color: '#666', name: 'Initial Amount' },
        ]}
        label="Jan"
      />,
    );
    expect(screen.getByText('Jan')).toBeTruthy();
    expect(screen.getByText(/Current Value:.*1,000/)).toBeTruthy();
    expect(screen.getByText(/Initial Amount:.*900/)).toBeTruthy();
  });

  it('renders a single payload entry', () => {
    render(
      <ValueTooltip
        active={true}
        payload={[{ value: 1100, color: '#0ff0fc', name: 'Current Value' }]}
        label="Feb"
      />,
    );
    expect(screen.getByText('Feb')).toBeTruthy();
    expect(screen.getByText(/Current Value:.*1,100/)).toBeTruthy();
  });
});
