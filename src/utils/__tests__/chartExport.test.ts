// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  buildHealthMetricsCsv,
  buildHealthMetricsCsvContent,
  buildHealthMetricsFilename,
  downloadBlob,
  downloadCsvContent,
  sanitizeExportFilename,
  buildAttestationCsvRows,
  buildAttestationCsvContent,
  buildAttestationExportFilename,
  ATTESTATION_CSV_HEADERS,
  exportSvgElementToPng,
  exportChartContainerToPng,
} from '@/utils/chartExport';
import type { Attestation } from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';

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

// ── Attestation CSV export helpers ────────────────────────────────────────

const sampleAttestation: Attestation = {
  id: 'att-001',
  title: 'Health Check Passed',
  description: 'All metrics within acceptable range',
  txHash: 'abcd1234efgh5678',
  timestamp: '2026-06-27T12:00:00.000Z',
  severity: 'ok',
};

const sampleAttestationWithDate: Attestation = {
  id: 'att-002',
  title: 'Drawdown Warning',
  description: 'Drawdown exceeded 50% threshold',
  txHash: 'wxyz9876',
  timestamp: new Date('2026-06-26T08:30:00.000Z'),
  severity: 'warning',
};

describe('Attestation CSV export helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-27T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ATTESTATION_CSV_HEADERS has the expected columns', () => {
    expect(ATTESTATION_CSV_HEADERS).toEqual([
      'ID',
      'Title',
      'Description',
      'TX Hash',
      'Timestamp',
      'Severity',
    ]);
  });

  it('buildAttestationCsvRows handles string timestamps directly', () => {
    const rows = buildAttestationCsvRows([sampleAttestation]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual([
      'att-001',
      'Health Check Passed',
      'All metrics within acceptable range',
      'abcd1234efgh5678',
      '2026-06-27T12:00:00.000Z',
      'ok',
    ]);
  });

  it('buildAttestationCsvRows converts Date objects to ISO strings', () => {
    const rows = buildAttestationCsvRows([sampleAttestationWithDate]);
    expect(rows).toHaveLength(1);
    expect(rows[0][4]).toBe('2026-06-26T08:30:00.000Z');
  });

  it('buildAttestationCsvRows handles mixed string and Date timestamps', () => {
    const rows = buildAttestationCsvRows([
      sampleAttestation,
      sampleAttestationWithDate,
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0][4]).toBe('2026-06-27T12:00:00.000Z');
    expect(rows[1][4]).toBe('2026-06-26T08:30:00.000Z');
  });

  it('buildAttestationCsvContent produces valid CSV with header row', () => {
    const csv = buildAttestationCsvContent([sampleAttestation]);
    expect(csv).toContain('ID,Title,Description,TX Hash,Timestamp,Severity');
    expect(csv).toContain('att-001');
    expect(csv).toContain('Health Check Passed');
  });

  it('buildAttestationCsvContent escapes formula-like attestation titles', () => {
    const alertAttestation: Attestation = {
      id: 'att-003',
      title: '=FORMULA_INJECTION',
      description: 'Normal description',
      txHash: 'hash',
      timestamp: '2026-01-01',
      severity: 'violation',
    };
    const csv = buildAttestationCsvContent([alertAttestation]);
    expect(csv).toContain("'=FORMULA_INJECTION");
  });

  it('buildAttestationCsvContent returns header-only CSV for empty attestations', () => {
    const csv = buildAttestationCsvContent([]);
    expect(csv).toBe('ID,Title,Description,TX Hash,Timestamp,Severity\r\n');
  });

  it('buildAttestationExportFilename sanitizes the commitment id', () => {
    const filename = buildAttestationExportFilename('cmt/ABC-123');
    expect(filename).toBe('attestations-cmt-ABC-123-2026-06-27.csv');
  });

  it('buildAttestationExportFilename falls back to "commitment" when id is empty', () => {
    const filename = buildAttestationExportFilename('');
    expect(filename).toBe('attestations-commitment-2026-06-27.csv');
  });
});

// ── PNG export helpers ────────────────────────────────────────────────────

describe('PNG export helpers', () => {
  beforeEach(() => {
    // Mock URL static methods
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock downloadBlob to avoid real DOM download
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── loadImage (private, tested indirectly via exportSvgElementToPng) ──

  it('exportSvgElementToPng throws when canvas context is unavailable', async () => {
    const mockSvg = {
      cloneNode: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockReturnValue(null),
        setAttribute: vi.fn(),
        cloneNode: vi.fn(),
      }),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 100, height: 50 }),
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as SVGSVGElement;

    // Mock canvas getContext to return null
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    // Mock Image constructor success
    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        // Simulate async image load
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(
      exportSvgElementToPng(mockSvg, 'chart.png'),
    ).rejects.toThrow('Canvas context unavailable');

    HTMLCanvasElement.prototype.getContext = origGetContext;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng throws when toBlob returns null', async () => {
    const mockSvg = {
      cloneNode: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockReturnValue(null),
        setAttribute: vi.fn(),
        cloneNode: vi.fn(),
      }),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 100, height: 50 }),
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as SVGSVGElement;

    // Mock canvas with context that supports drawImage but toBlob returns null
    const mockCtx = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    // Mock toBlob to invoke callback with null
    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(null);
    });

    // Mock Image constructor success
    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(
      exportSvgElementToPng(mockSvg, 'chart.png'),
    ).rejects.toThrow('Failed to create PNG blob');

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng successfully downloads a PNG blob', async () => {
    const mockSvg = {
      cloneNode: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockReturnValue(null),
        setAttribute: vi.fn(),
        cloneNode: vi.fn(),
      }),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 200, height: 100 }),
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as SVGSVGElement;

    const mockCtx = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    const fakeBlob = new Blob(['fake-png'], { type: 'image/png' });
    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(fakeBlob);
    });

    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(
      exportSvgElementToPng(mockSvg, 'chart.png'),
    ).resolves.toBeUndefined();

    expect(URL.createObjectURL).toHaveBeenCalled();

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng handles image load failure', async () => {
    const mockSvg = {
      cloneNode: vi.fn().mockReturnValue({
        getAttribute: vi.fn().mockReturnValue(null),
        setAttribute: vi.fn(),
        cloneNode: vi.fn(),
      }),
      getBoundingClientRect: vi.fn().mockReturnValue({ width: 100, height: 50 }),
      getAttribute: vi.fn(),
      setAttribute: vi.fn(),
    } as unknown as SVGSVGElement;

    // Mock Image to trigger error
    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(
      exportSvgElementToPng(mockSvg, 'chart.png'),
    ).rejects.toThrow('Failed to load chart SVG for PNG export');

    globalThis.Image = origImage;
  });

  // ── exportChartContainerToPng ─────────────────────────────────────────

  it('exportChartContainerToPng throws when SVG is not found', async () => {
    const container = document.createElement('div');
    // No SVG inside the container

    await expect(
      exportChartContainerToPng(container, 'chart.png'),
    ).rejects.toThrow('Chart SVG not found');
  });

  it('exportChartContainerToPng finds a valid SVG and delegates to export', async () => {
    const container = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('recharts-surface');
    container.appendChild(svg);

    // The delegate exportSvgElementToPng will try to load an image,
    // so make the Image constructor fail fast to avoid complex canvas mocks
    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(
      exportChartContainerToPng(container, 'chart.png'),
    ).rejects.toThrow('Failed to load chart SVG for PNG export');

    globalThis.Image = origImage;
  });
});
