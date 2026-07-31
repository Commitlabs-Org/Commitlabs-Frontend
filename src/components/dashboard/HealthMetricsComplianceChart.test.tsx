/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { HealthMetricsComplianceChart } from './HealthMetricsComplianceChart';

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

let capturedTooltipElement: React.ReactElement | null = null;

// Mock recharts components to allow isolated assertions on chart props & custom sub-components
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container">{children}</div>
    ),
    LineChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
      <div data-testid="line-chart" data-count={data?.length ?? 0}>
        {children}
      </div>
    ),
    CartesianGrid: ({ vertical, stroke }: { vertical?: boolean; stroke?: string }) => (
      <div data-testid="cartesian-grid" data-vertical={vertical} data-stroke={stroke} />
    ),
    XAxis: ({ dataKey }: { dataKey?: string }) => <div data-testid="x-axis" data-key={dataKey} />,
    YAxis: ({ domain }: { domain?: [number, number] }) => (
      <div data-testid="y-axis" data-domain={domain?.join(',')} />
    ),
    Tooltip: ({ content }: { content?: React.ReactElement }) => {
      capturedTooltipElement = content ?? null;
      if (!content) return null;
      return (
        <div data-testid="tooltip-wrapper">
          {React.cloneElement(content, {
            active: true,
            label: '2026-01-15',
            payload: [{ value: 92 }],
          })}
        </div>
      );
    },
    Legend: ({ content }: { content?: () => React.ReactNode }) => (
      <div data-testid="chart-legend">{typeof content === 'function' ? content() : null}</div>
    ),
    Line: ({ dataKey, stroke }: { dataKey?: string; stroke?: string }) => (
      <div data-testid="line" data-key={dataKey} data-stroke={stroke} />
    ),
  };
});

interface TooltipMockProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ value: number }>;
}

describe('HealthMetricsComplianceChart', () => {
  const populatedData = [
    { date: '2026-01-01', complianceScore: 80 },
    { date: '2026-01-02', complianceScore: 92 },
    { date: '2026-01-03', complianceScore: 100 },
  ];

  describe('Rendering with populated data', () => {
    it('renders the chart container and elements without crashing', () => {
      const { container } = render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(container.firstChild).toBeTruthy();
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('passes data correctly to LineChart', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      const lineChart = screen.getByTestId('line-chart');
      expect(lineChart).toHaveAttribute('data-count', '3');
    });

    it('renders axis and chart configuration correctly', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(screen.getByTestId('x-axis')).toHaveAttribute('data-key', 'date');
      expect(screen.getByTestId('y-axis')).toHaveAttribute('data-domain', '0,100');
      expect(screen.getByTestId('line')).toHaveAttribute('data-key', 'complianceScore');
      expect(screen.getByTestId('line')).toHaveAttribute('data-stroke', '#4ADE80');
    });

    it('renders the legend with "Compliance Score" text', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(screen.getByText('Compliance Score')).toBeInTheDocument();
    });

    it('renders the historical compliance score description footer', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(
        screen.getByText(
          /Historical compliance score showing how well the commitment has adhered to its rules/i,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Empty and insufficient data handling', () => {
    it('renders without crashing when data array is empty', () => {
      const { container } = render(<HealthMetricsComplianceChart data={[]} />);
      expect(container.firstChild).toBeTruthy();
      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-count', '0');
    });

    it('renders the description footer even when data is empty', () => {
      render(<HealthMetricsComplianceChart data={[]} />);
      expect(
        screen.getByText(
          /Historical compliance score showing how well the commitment has adhered to its rules/i,
        ),
      ).toBeInTheDocument();
    });

    it('handles single-point series (insufficient data points for a line)', () => {
      const singlePointData = [{ date: '2026-01-01', complianceScore: 95 }];
      render(<HealthMetricsComplianceChart data={singlePointData} />);
      expect(screen.getByTestId('line-chart')).toHaveAttribute('data-count', '1');
    });
  });

  describe('Custom Tooltip rendering', () => {
    it('renders custom tooltip content with active score when chart is mounted', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(screen.getByText('2026-01-15')).toBeInTheDocument();
      expect(screen.getByText('Score: 92')).toBeInTheDocument();
    });

    it('renders expected compliance score text for varying active score values', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(capturedTooltipElement).not.toBeNull();

      const RenderCustomTooltip: React.FC<TooltipMockProps> = ({ active, label, payload }) => {
        if (!capturedTooltipElement) return null;
        return React.cloneElement(capturedTooltipElement, { active, label, payload });
      };

      const { getByText } = render(
        <RenderCustomTooltip active={true} label="2026-02-20" payload={[{ value: 100 }]} />,
      );
      expect(getByText('2026-02-20')).toBeInTheDocument();
      expect(getByText('Score: 100')).toBeInTheDocument();
    });

    it('returns null when tooltip active is false or payload is missing/empty', () => {
      render(<HealthMetricsComplianceChart data={populatedData} />);
      expect(capturedTooltipElement).not.toBeNull();

      const RenderCustomTooltip: React.FC<TooltipMockProps> = ({ active, label, payload }) => {
        if (!capturedTooltipElement) return null;
        return React.cloneElement(capturedTooltipElement, { active, label, payload });
      };

      const { container: containerInactive } = render(
        <RenderCustomTooltip active={false} label="2026-01-15" payload={[{ value: 92 }]} />,
      );
      expect(containerInactive.firstChild).toBeNull();

      const { container: containerEmptyPayload } = render(
        <RenderCustomTooltip active={true} label="2026-01-15" payload={[]} />,
      );
      expect(containerEmptyPayload.firstChild).toBeNull();
    });
  });
});
