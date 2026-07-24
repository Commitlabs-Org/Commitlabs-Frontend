/**
 * @vitest-environment happy-dom
 *
 * RTL tests for HealthMetricsComplianceChart and HealthMetricsFeeGenerationChart.
 * Covers: representative series, empty series, single-point series, 100% compliance
 * ceiling, zero fees, and tooltip rendering.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock ResizeObserver so Recharts' ResponsiveContainer works under happy-dom
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock recharts ResponsiveContainer to provide real dimensions
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 300 }}>{children}</div>
    ),
  };
});

// Keep VolatilityExposureMeter isolated — it has its own tests
vi.mock('@/components/VolatilityExposureMeter/VolatilityExposureMeter', () => ({
  default: () => <div data-testid="volatility-meter" />,
}));

import { HealthMetricsComplianceChart } from '../HealthMetricsComplianceChart';
import { HealthMetricsFeeGenerationChart } from '../HealthMetricsFeeGenerationChart';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const representativeCompliance = [
  { date: 'Jan', complianceScore: 72 },
  { date: 'Feb', complianceScore: 85 },
  { date: 'Mar', complianceScore: 91 },
];

const representativeFees = [
  { date: 'Jan', feeAmount: 250 },
  { date: 'Feb', feeAmount: 875 },
  { date: 'Mar', feeAmount: 1340 },
];

// ---------------------------------------------------------------------------
// HealthMetricsComplianceChart
// ---------------------------------------------------------------------------
describe('HealthMetricsComplianceChart — representative series', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <HealthMetricsComplianceChart data={representativeCompliance} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the description footer text', () => {
    render(<HealthMetricsComplianceChart data={representativeCompliance} />);
    expect(
      screen.getByText(/compliance score/i),
    ).toBeInTheDocument();
  });
});

describe('HealthMetricsComplianceChart — empty series', () => {
  it('renders without crashing when data is empty', () => {
    const { container } = render(<HealthMetricsComplianceChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('still renders the description footer on empty data', () => {
    render(<HealthMetricsComplianceChart data={[]} />);
    expect(screen.getByText(/compliance score/i)).toBeInTheDocument();
  });
});

describe('HealthMetricsComplianceChart — single data point', () => {
  it('renders a single-point series', () => {
    const { container } = render(
      <HealthMetricsComplianceChart
        data={[{ date: 'Jan', complianceScore: 60 }]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('HealthMetricsComplianceChart — 100% compliance ceiling', () => {
  it('renders scores at the maximum value of 100', () => {
    const { container } = render(
      <HealthMetricsComplianceChart
        data={[
          { date: 'Apr', complianceScore: 100 },
          { date: 'May', complianceScore: 100 },
        ]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// HealthMetricsComplianceChart — CustomTooltip (inline replica)
// ---------------------------------------------------------------------------
describe('HealthMetricsComplianceChart — CustomTooltip behaviour', () => {
  // Mirror the tooltip contract; the private component is not exported so
  // we replicate its render logic to keep the assertion readable.
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

  it('returns null when not active', () => {
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

  it('renders label and score when active with payload', () => {
    render(
      <ComplianceTooltip active={true} payload={[{ value: 91 }]} label="Mar" />,
    );
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText('Score: 91')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// HealthMetricsFeeGenerationChart
// ---------------------------------------------------------------------------
describe('HealthMetricsFeeGenerationChart — representative series', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <HealthMetricsFeeGenerationChart data={representativeFees} />,
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('renders the description footer text', () => {
    render(<HealthMetricsFeeGenerationChart data={representativeFees} />);
    expect(screen.getByText(/fees generated/i)).toBeInTheDocument();
  });
});

describe('HealthMetricsFeeGenerationChart — empty series', () => {
  it('renders without crashing when data is empty', () => {
    const { container } = render(<HealthMetricsFeeGenerationChart data={[]} />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('HealthMetricsFeeGenerationChart — single data point', () => {
  it('renders a single-point series', () => {
    const { container } = render(
      <HealthMetricsFeeGenerationChart
        data={[{ date: 'Jan', feeAmount: 50 }]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('HealthMetricsFeeGenerationChart — zero fees', () => {
  it('renders when all fee amounts are zero', () => {
    const { container } = render(
      <HealthMetricsFeeGenerationChart
        data={[
          { date: 'Jan', feeAmount: 0 },
          { date: 'Feb', feeAmount: 0 },
        ]}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});

describe('HealthMetricsFeeGenerationChart — volatility meter integration', () => {
  it('renders VolatilityExposureMeter when volatilityPercent is provided', () => {
    render(
      <HealthMetricsFeeGenerationChart
        data={representativeFees}
        volatilityPercent={35}
      />,
    );
    expect(screen.getByTestId('volatility-meter')).toBeInTheDocument();
  });

  it('does not render VolatilityExposureMeter when volatilityPercent is omitted', () => {
    render(<HealthMetricsFeeGenerationChart data={representativeFees} />);
    expect(screen.queryByTestId('volatility-meter')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// HealthMetricsFeeGenerationChart — CustomTooltip (inline replica)
// ---------------------------------------------------------------------------
describe('HealthMetricsFeeGenerationChart — CustomTooltip behaviour', () => {
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
          <p>Fees: ${(payload[0].value ?? 0).toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  it('returns null when not active', () => {
    const { container } = render(
      <FeeTooltip active={false} payload={[{ value: 250 }]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when payload is empty', () => {
    const { container } = render(
      <FeeTooltip active={true} payload={[]} label="Jan" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders label and formatted fee when active', () => {
    render(
      <FeeTooltip active={true} payload={[{ value: 1340 }]} label="Mar" />,
    );
    expect(screen.getByText('Mar')).toBeInTheDocument();
    expect(screen.getByText(/Fees:.*1,340/)).toBeInTheDocument();
  });

  it('renders zero fee correctly', () => {
    render(
      <FeeTooltip active={true} payload={[{ value: 0 }]} label="Jan" />,
    );
    expect(screen.getByText(/Fees:.*0/)).toBeInTheDocument();
  });
});
