// @vitest-environment happy-dom

import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu';

const exportData = {
  valueHistoryData: [{ date: 'Jan 1', currentValue: 1000, initialAmount: 900 }],
  drawdownData: [{ date: 'Jan 1', drawdownPercent: 0.1 }],
  feeGenerationData: [{ date: 'Jan 1', feeAmount: 12 }],
  complianceData: [{ date: 'Jan 1', complianceScore: 99 }],
};

vi.mock('@/utils/chartExport', async () => {
  const actual = await vi.importActual<typeof import('@/utils/chartExport')>('@/utils/chartExport');
  return {
    ...actual,
    downloadCsvContent: vi.fn().mockResolvedValue(undefined),
    exportChartContainerToPng: vi.fn().mockResolvedValue(undefined),
  };
});

import { downloadCsvContent, exportChartContainerToPng } from '@/utils/chartExport';

describe('ChartExportMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables export buttons while loading', () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    render(
      <div ref={chartContainerRef}>
        <ChartExportMenu
          commitmentId="1"
          tab="value"
          data={exportData}
          disabled
          chartContainerRef={chartContainerRef}
        />
      </div>,
    );

    expect(screen.getByRole('button', { name: 'Export value chart data as CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Export value chart as PNG' })).toBeDisabled();
  });

  it('triggers CSV export for the active tab', async () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    render(
      <div ref={chartContainerRef}>
        <ChartExportMenu
          commitmentId="cmt-1"
          tab="fee"
          data={exportData}
          chartContainerRef={chartContainerRef}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export fee chart data as CSV' }));
    expect(downloadCsvContent).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(downloadCsvContent).mock.calls[0]?.[1])).toContain('fee-generation');
  });

  it('triggers PNG export using the chart container ref', async () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    render(
      <div ref={chartContainerRef} data-testid="chart-container">
        <svg className="recharts-surface" />
        <ChartExportMenu
          commitmentId="cmt-1"
          tab="drawdown"
          data={exportData}
          chartContainerRef={chartContainerRef}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Export drawdown chart as PNG' }));
    expect(exportChartContainerToPng).toHaveBeenCalledWith(
      chartContainerRef.current,
      expect.stringContaining('drawdown'),
    );
  });
});
