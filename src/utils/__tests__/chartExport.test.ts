import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildAttestationCsvContent,
  buildAttestationCsvRows,
  buildAttestationExportFilename,
  buildHealthMetricsCsv,
  buildHealthMetricsCsvContent,
  buildHealthMetricsFilename,
  downloadBlob,
  downloadCsvContent,
  exportChartContainerToPng,
  exportSvgElementToPng,
  loadImage,
  sanitizeExportFilename,
} from '../chartExport';

const mockCreateObjectURL = vi.fn(() => 'blob:test');
const mockRevokeObjectURL = vi.fn();

Object.defineProperty(URL, 'createObjectURL', {
  writable: true,
  value: mockCreateObjectURL,
});

Object.defineProperty(URL, 'revokeObjectURL', {
  writable: true,
  value: mockRevokeObjectURL,
});

describe('chartExport', () => {
  describe('sanitizeExportFilename', () => {
    it('removes unsafe filename characters', () => {
      expect(sanitizeExportFilename('my/report:file?.csv')).toBe('my-report-file-.csv');
    });

    it('normalizes whitespace and falls back for an empty filename', () => {
      expect(sanitizeExportFilename('  hello   world  ')).toBe('hello-world');
      expect(sanitizeExportFilename('   ')).toBe('export');
    });
  });

  describe('health metrics CSV', () => {
    it('builds value-history CSV content', () => {
      const content = buildHealthMetricsCsvContent([
        {
          date: 'Jan 10',
          currentValue: 50000,
          initialAmount: 50000,
          benchmarkValue: 49000,
        },
        {
          date: 'Jan 15',
          currentValue: 52000,
          initialAmount: 50000,
        },
      ]);

      expect(content).toBe(
        [
          'Date,Current Value,Initial Amount,Benchmark Value',
          'Jan 10,50000,50000,49000',
          'Jan 15,52000,50000,',
          '',
        ].join('\r\n'),
      );
    });

    it('builds drawdown CSV content', () => {
      expect(
        buildHealthMetricsCsvContent([
          { date: 'Jan 10', drawdownPercent: 0 },
          { date: 'Jan 15', drawdownPercent: 0.35 },
        ]),
      ).toContain('Jan 15,0.35');
    });

    it('builds compliance CSV content', () => {
      expect(
        buildHealthMetricsCsvContent([
          { date: 'Jan 10', complianceScore: 98 },
          { date: 'Jan 15', complianceScore: 95 },
        ]),
      ).toContain('Jan 15,95');
    });

    it('builds fee CSV content', () => {
      expect(
        buildHealthMetricsCsvContent([
          { date: 'Jan 10', feeAmount: 25 },
          { date: 'Jan 15', feeAmount: 45 },
        ]),
      ).toContain('Jan 15,45');
    });

    it('returns empty content for an empty series', () => {
      expect(buildHealthMetricsCsvContent([])).toBe('');
    });

    it('creates a CSV blob', async () => {
      const blob = buildHealthMetricsCsv([{ date: 'Jan 10', complianceScore: 98 }]);

      expect(blob.type).toBe('text/csv;charset=utf-8');
      expect(await blob.text()).toContain('Compliance Score');
    });

    it('builds a sanitized health-metrics filename', () => {
      expect(buildHealthMetricsFilename('value history/chart')).toBe('value-history-chart.csv');
    });
  });

  describe('attestation CSV', () => {
    const date = new Date('2026-09-29T12:00:00.000Z');

    const attestations = [
      {
        id: '1',
        title: 'Daily Compliance Check',
        description: 'All parameters within acceptable ranges.',
        txHash: '0xabc123',
        timestamp: date,
        severity: 'ok' as const,
      },
      {
        id: '2',
        title: 'Allocation Verified',
        description: 'Portfolio allocation meets all constraints.',
        txHash: '0xdef456',
        timestamp: '2026-09-28T12:00:00.000Z',
        severity: 'warning' as const,
      },
    ];

    it('supports Date and string timestamps', () => {
      const rows = buildAttestationCsvRows(attestations);

      expect(rows).toEqual([
        [
          '1',
          'Daily Compliance Check',
          'All parameters within acceptable ranges.',
          '0xabc123',
          '2026-09-29T12:00:00.000Z',
          'ok',
        ],
        [
          '2',
          'Allocation Verified',
          'Portfolio allocation meets all constraints.',
          '0xdef456',
          '2026-09-28T12:00:00.000Z',
          'warning',
        ],
      ]);
    });

    it('builds the attestation CSV with headers', () => {
      const content = buildAttestationCsvContent(attestations);

      expect(content).toContain('ID,Title,Description,Transaction Hash,Timestamp,Severity');

      expect(content).toContain(
        '1,Daily Compliance Check,All parameters within acceptable ranges.,0xabc123,2026-09-29T12:00:00.000Z,ok',
      );
    });

    it('escapes CSV values containing commas, quotes, and newlines', () => {
      const content = buildAttestationCsvContent([
        {
          id: '1',
          title: 'Title, with comma',
          description: 'Description with "quotes"\nand a newline',
          txHash: '0x123',
          timestamp: date,
          severity: 'ok',
        },
      ]);

      expect(content).toContain('"Title, with comma"');

      expect(content).toContain('"Description with ""quotes""\nand a newline"');
    });

    it('builds an attestation export filename', () => {
      expect(buildAttestationExportFilename('commitment/123')).toBe(
        'commitment-123-attestations.csv',
      );
    });
  });

  describe('downloads', () => {
    beforeEach(() => {
      mockCreateObjectURL.mockClear();
      mockRevokeObjectURL.mockClear();
      mockCreateObjectURL.mockReturnValue('blob:test');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('downloads a blob and revokes its object URL', () => {
      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      downloadBlob(new Blob(['hello']), 'report.csv');

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test');
    });

    it('downloads CSV content as a blob', () => {
      mockCreateObjectURL.mockReturnValue('blob:csv');

      const click = vi.spyOn(HTMLAnchorElement.prototype, 'click');

      downloadCsvContent('a,b\r\n1,2\r\n', 'data.csv');

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
    });
  });

  describe('loadImage', () => {
    it('resolves when the image loads', async () => {
      const originalImage = globalThis.Image;

      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }

      globalThis.Image = MockImage as unknown as typeof Image;

      try {
        await expect(loadImage('blob:test')).resolves.toBeInstanceOf(MockImage);
      } finally {
        globalThis.Image = originalImage;
      }
    });

    it('rejects when the image fails to load', async () => {
      const originalImage = globalThis.Image;

      class MockImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        set src(_value: string) {
          queueMicrotask(() => this.onerror?.());
        }
      }

      globalThis.Image = MockImage as unknown as typeof Image;

      try {
        await expect(loadImage('blob:test')).rejects.toThrow('Failed to load image');
      } finally {
        globalThis.Image = originalImage;
      }
    });
  });

  describe('PNG export', () => {
    beforeEach(() => {
      mockCreateObjectURL.mockClear();
      mockRevokeObjectURL.mockClear();
      mockCreateObjectURL.mockReturnValue('blob:test');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('rejects when the canvas context is unavailable', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      vi.spyOn(globalThis, 'Image').mockImplementation(() => {
        const image = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,

          set src(_value: string) {
            queueMicrotask(() => image.onload?.());
          },
        };

        return image as unknown as HTMLImageElement;
      });

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

      await expect(exportSvgElementToPng(svg)).rejects.toThrow('Canvas 2D context is unavailable');
    });

    it('rejects when canvas.toBlob fails to create a blob', async () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      vi.spyOn(globalThis, 'Image').mockImplementation(() => {
        const image = {
          onload: null as (() => void) | null,
          onerror: null as (() => void) | null,

          set src(_value: string) {
            queueMicrotask(() => image.onload?.());
          },
        };

        return image as unknown as HTMLImageElement;
      });

      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: vi.fn(),
      } as unknown as CanvasRenderingContext2D);

      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
        callback(null);
      });

      await expect(exportSvgElementToPng(svg)).rejects.toThrow('Failed to create PNG blob');
    });

    it('rejects when the chart SVG is missing', async () => {
      const container = document.createElement('div');

      await expect(exportChartContainerToPng(container)).rejects.toThrow(
        'Chart SVG element was not found',
      );
    });
  });
});
