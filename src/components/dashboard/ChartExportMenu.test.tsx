// @vitest-environment happy-dom

import React, { createRef } from 'react';
import { fireEvent, render, screen, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartExportMenu } from '@/components/dashboard/ChartExportMenu';

const exportData = {
  valueHistoryData: [{ date: 'Jan 1', currentValue: 1000, initialAmount: 900 }],
  drawdownData: [{ date: 'Jan 1', drawdownPercent: 0.1 }],
  feeGenerationData: [{ date: 'Jan 1', feeAmount: 12 }],
  complianceData: [{ date: 'Jan 1', complianceScore: 99 }],
};

const mockToastError = vi.fn();
vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({
    error: mockToastError,
  }),
}));

vi.mock('@/utils/chartExport', async () => {
  const actual = await vi.importActual<typeof import('@/utils/chartExport')>('@/utils/chartExport');
  return {
    ...actual,
    downloadCsvContent: vi.fn().mockResolvedValue(undefined),
    exportChartContainerToPng: vi.fn().mockResolvedValue(undefined),
    downloadBlob: vi.fn().mockResolvedValue(undefined),
  };
});

import { downloadCsvContent, exportChartContainerToPng, downloadBlob } from '@/utils/chartExport';

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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export fee chart data as CSV' }));
    });
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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export drawdown chart as PNG' }));
    });
    expect(exportChartContainerToPng).toHaveBeenCalledWith(
      chartContainerRef.current,
      expect.stringContaining('drawdown'),
    );
  });

  it('surfaces a visible error toast when CSV export fails', async () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    const testError = new Error('CSV network error');
    vi.mocked(downloadCsvContent).mockRejectedValueOnce(testError);

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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export fee chart data as CSV' }));
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: 'Export failed',
      description: 'CSV network error',
    });
  });

  it('surfaces a visible error toast when PNG export fails', async () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    const testError = new Error('CORS tainted canvas');
    vi.mocked(exportChartContainerToPng).mockRejectedValueOnce(testError);

    render(
      <div ref={chartContainerRef}>
        <svg className="recharts-surface" />
        <ChartExportMenu
          commitmentId="cmt-1"
          tab="drawdown"
          data={exportData}
          chartContainerRef={chartContainerRef}
        />
      </div>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export drawdown chart as PNG' }));
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: 'Export failed',
      description: 'CORS tainted canvas',
    });
  });

  it('surfaces a visible error toast when JSON export fails', async () => {
    const chartContainerRef = createRef<HTMLDivElement>();
    const testError = new Error('Disk full');
    vi.mocked(downloadBlob).mockRejectedValueOnce(testError);

    render(
      <div ref={chartContainerRef}>
        <ChartExportMenu
          commitmentId="cmt-1"
          tab="value"
          data={exportData}
          chartContainerRef={chartContainerRef}
        />
      </div>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Export value chart data as JSON' }));
    });

    expect(mockToastError).toHaveBeenCalledWith({
      title: 'Export failed',
      description: 'Disk full',
    });
  });
});
