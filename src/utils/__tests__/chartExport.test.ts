// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildHealthMetricsCsv,
  buildHealthMetricsCsvContent,
  buildHealthMetricsFilename,
  downloadBlob,
  downloadCsvContent,
  sanitizeExportFilename,
} from '@/utils/chartExport';

const sampleData = {
  valueHistoryData: [
    { date: 'Jan 1', currentValue: 1000, initialAmount: 900 },
    { date: 'Jan 2', currentValue: 1100 },
  ],
  drawdownData: [
    { date: 'Jan 1', drawdownPercent: 0.15 },
    { date: 'Jan 2', drawdownPercent: 2.5 },
  ],
  feeGenerationData: [{ date: 'Jan 1', feeAmount: 25 }],
  complianceData: [{ date: 'Jan 1', complianceScore: 98 }],
};

describe('chartExport', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds value history CSV rows', () => {
    const { headers, rows } = buildHealthMetricsCsv('value', sampleData);
    expect(headers).toEqual(['Date', 'Current Value', 'Initial Amount']);
    expect(rows[0]).toEqual(['Jan 1', '1000', '900']);
    expect(rows[1]).toEqual(['Jan 2', '1100', '']);
  });

  it('normalizes fractional drawdown values to percent strings', () => {
    const { rows } = buildHealthMetricsCsv('drawdown', sampleData);
    expect(rows[0]).toEqual(['Jan 1', '15.00%']);
    expect(rows[1]).toEqual(['Jan 2', '2.50%']);
  });

  it('escapes formula-like CSV values', () => {
    const csv = buildHealthMetricsCsvContent('fee', {
      ...sampleData,
      feeGenerationData: [{ date: '=SUM(A1)', feeAmount: 10 }],
    });
    expect(csv).toContain("'=SUM(A1)");
  });

  it('returns empty CSV content for empty series', () => {
    const csv = buildHealthMetricsCsvContent('compliance', {
      ...sampleData,
      complianceData: [],
    });
    expect(csv).toBe('Date,Compliance Score\r\n');
  });

  it('sanitizes export filenames', () => {
    expect(sanitizeExportFilename('bad/name with spaces')).toBe('bad-name-with-spaces');
    expect(buildHealthMetricsFilename('cmt/001', 'value', 'csv')).toBe(
      'health-metrics-cmt-001-value-history-2026-06-27.csv',
    );
  });

  it('downloads CSV content via blob link', async () => {
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:test'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadCsvContent('Date,Value\r\nJan,1\r\n', 'metrics.csv');
    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloads arbitrary blobs', async () => {
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:png'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await downloadBlob(new Blob(['x'], { type: 'image/png' }), 'chart.png');
    expect(clickSpy).toHaveBeenCalled();
  });
});
