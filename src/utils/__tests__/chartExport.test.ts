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
  loadImage,
  exportSvgElementToPng,
  exportChartContainerToPng,
  type Attestation,
  type HealthMetricsTab,
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

function createMockSvgElement(width = 100, height = 50): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.getBoundingClientRect = vi.fn().mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    bottom: height,
    right: width,
  } as DOMRect);
  return svg;
}

describe('chartExport health metrics helpers', () => {
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

  it('builds fee generation CSV rows', () => {
    const { headers, rows } = buildHealthMetricsCsv('fee', sampleData);
    expect(headers).toEqual(['Date', 'Fee Amount']);
    expect(rows[0]).toEqual(['Jan 1', '25']);
  });

  it('builds compliance CSV rows', () => {
    const { headers, rows } = buildHealthMetricsCsv('compliance', sampleData);
    expect(headers).toEqual(['Date', 'Compliance Score']);
    expect(rows[0]).toEqual(['Jan 1', '98']);
  });

  it('returns empty headers and rows for an unrecognized tab', () => {
    const result = buildHealthMetricsCsv('unrecognized' as HealthMetricsTab, sampleData);
    expect(result).toEqual({ headers: [], rows: [] });
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
    expect(sanitizeExportFilename('---already-trimmed---')).toBe('already-trimmed');
    expect(buildHealthMetricsFilename('cmt/001', 'value', 'csv')).toBe(
      'health-metrics-cmt-001-value-history-2026-06-27.csv',
    );
  });

  it('buildHealthMetricsFilename falls back to commitment when id is empty', () => {
    expect(buildHealthMetricsFilename('', 'drawdown', 'png')).toBe(
      'health-metrics-commitment-drawdown-2026-06-27.png',
    );
    expect(buildHealthMetricsFilename('cmt-01', 'unknown' as HealthMetricsTab, 'csv')).toBe(
      'health-metrics-cmt-01-metrics-2026-06-27.csv',
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
    expect(rows[0]?.[4]).toBe('2026-06-26T08:30:00.000Z');
  });

  it('buildAttestationCsvRows handles mixed string and Date timestamps', () => {
    const rows = buildAttestationCsvRows([sampleAttestation, sampleAttestationWithDate]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.[4]).toBe('2026-06-27T12:00:00.000Z');
    expect(rows[1]?.[4]).toBe('2026-06-26T08:30:00.000Z');
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

describe('loadImage helper', () => {
  it('resolves image element on successful load', async () => {
    const originalImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    const result = await loadImage('blob:test');
    expect(result).toBeInstanceOf(Object);

    globalThis.Image = originalImage;
  });

  it('rejects on image load error', async () => {
    const originalImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(loadImage('blob:invalid')).rejects.toThrow(
      'Failed to load chart SVG for PNG export',
    );

    globalThis.Image = originalImage;
  });
});

describe('PNG export helpers', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:svg-mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exportSvgElementToPng throws when canvas context is unavailable', async () => {
    const svgElement = createMockSvgElement(100, 50);

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(exportSvgElementToPng(svgElement, 'chart.png')).rejects.toThrow(
      'Canvas context unavailable',
    );

    HTMLCanvasElement.prototype.getContext = origGetContext;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng throws when toBlob returns null', async () => {
    const svgElement = createMockSvgElement(100, 50);

    const mockCtx = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    const origToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (blob: Blob | null) => void) => {
      cb(null);
    });

    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(exportSvgElementToPng(svgElement, 'chart.png')).rejects.toThrow(
      'Failed to create PNG blob',
    );

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng successfully downloads a PNG blob and sets xmlns if missing', async () => {
    const svgElement = createMockSvgElement(200, 100);

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

    await expect(exportSvgElementToPng(svgElement, 'chart.png')).resolves.toBeUndefined();

    expect(URL.createObjectURL).toHaveBeenCalled();

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
  });

  it('exportSvgElementToPng handles image load failure', async () => {
    const svgElement = createMockSvgElement(100, 50);

    const origImage = globalThis.Image;
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    } as unknown as typeof Image;

    await expect(exportSvgElementToPng(svgElement, 'chart.png')).rejects.toThrow(
      'Failed to load chart SVG for PNG export',
    );

    globalThis.Image = origImage;
  });

  it('exportChartContainerToPng throws when SVG is not found', async () => {
    const container = document.createElement('div');

    await expect(exportChartContainerToPng(container, 'chart.png')).rejects.toThrow(
      'Chart SVG not found',
    );
  });

  it('exportChartContainerToPng finds a valid SVG and delegates to export', async () => {
    const container = document.createElement('div');
    const svg = createMockSvgElement(150, 75);
    svg.classList.add('recharts-surface');
    container.appendChild(svg);

    const mockCtx = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    const fakeBlob = new Blob(['fake-chart-png'], { type: 'image/png' });
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
      exportChartContainerToPng(container, 'container-chart.png'),
    ).resolves.toBeUndefined();

    HTMLCanvasElement.prototype.getContext = origGetContext;
    HTMLCanvasElement.prototype.toBlob = origToBlob;
    globalThis.Image = origImage;
  });
});
