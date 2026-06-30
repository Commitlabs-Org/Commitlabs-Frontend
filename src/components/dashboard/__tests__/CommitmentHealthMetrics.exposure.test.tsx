/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { HealthMetricsValueHistoryChart } from '../HealthMetricsValueHistoryChart';
import {
  computeCommitmentExposure,
  type CommitmentExposureResult,
} from '@/utils/exposure';

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

const valueData = [
  { date: 'Jan 1', currentValue: 1000, initialAmount: 1000 },
  { date: 'Jan 2', currentValue: 1010, initialAmount: 1000 },
];

function renderWithExposure(exposure: CommitmentExposureResult) {
  return render(
    <HealthMetricsValueHistoryChart data={valueData} exposure={exposure} />,
  );
}

describe('VolatilityExposureMeter live binding', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows insufficient data state when exposure cannot be computed', () => {
    const exposure = computeCommitmentExposure({
      maxLossPercent: 8,
      valueHistory: [{ date: 'Jan 1', currentValue: 1000 }],
    });

    renderWithExposure(exposure);

    expect(screen.getByText(/Insufficient data/i)).toBeTruthy();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuetext', 'Insufficient data');
  });

  it('binds computed low-zone exposure to the meter', () => {
    const exposure = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.02 }],
    });

    renderWithExposure(exposure);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '20');
    expect(meter).toHaveAttribute('aria-valuetext', '20 percent, low');
  });

  it('binds computed medium-zone exposure at zone boundaries', () => {
    const exposure = computeCommitmentExposure({
      maxLossPercent: 10,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.034 }],
    });

    renderWithExposure(exposure);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuetext', '34 percent, medium');
  });

  it('binds computed high-zone exposure to the meter', () => {
    const exposure = computeCommitmentExposure({
      maxLossPercent: 8,
      drawdownHistory: [{ date: 'Jan 1', drawdownPercent: 0.08 }],
    });

    renderWithExposure(exposure);

    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuetext', '100 percent, high');
  });
});
