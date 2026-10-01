export interface HealthMetricsValueHistoryPoint {
  date: string;
  currentValue: number;
  initialAmount?: number;
  benchmarkValue?: number | null;
}

export interface HealthMetricsDrawdownPoint {
  date: string;
  drawdownPercent: number;
}

export interface HealthMetricsCompliancePoint {
  date: string;
  complianceScore: number;
}

export interface HealthMetricsFeePoint {
  date: string;
  feeAmount: number;
}

export type HealthMetricsPoint =
  | HealthMetricsValueHistoryPoint
  | HealthMetricsDrawdownPoint
  | HealthMetricsCompliancePoint
  | HealthMetricsFeePoint;

export interface AttestationExportRow {
  id: string;
  title: string;
  description: string;
  txHash: string;
  timestamp: Date | string;
  severity: 'ok' | 'warning' | 'violation';
}

function escapeCsvValue(value: unknown): string {
  const text = value == null ? '' : String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function formatTimestamp(timestamp: Date | string): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }

  return date.toISOString();
}

function buildCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n') + '\r\n';
}

export function sanitizeExportFilename(filename: string): string {
  const sanitized = filename
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || 'export';
}

export function buildHealthMetricsCsvContent(data: readonly HealthMetricsPoint[]): string {
  if (data.length === 0) {
    return '';
  }

  const first = data[0]!;

  if ('currentValue' in first) {
    return buildCsv([
      ['Date', 'Current Value', 'Initial Amount', 'Benchmark Value'],
      ...data.map((point) => {
        if (!('currentValue' in point)) {
          return [point.date];
        }

        return [
          point.date,
          point.currentValue,
          point.initialAmount ?? '',
          point.benchmarkValue ?? '',
        ];
      }),
    ]);
  }

  if ('drawdownPercent' in first) {
    return buildCsv([
      ['Date', 'Drawdown Percent'],
      ...data.map((point) =>
        'drawdownPercent' in point ? [point.date, point.drawdownPercent] : [point.date],
      ),
    ]);
  }

  if ('complianceScore' in first) {
    return buildCsv([
      ['Date', 'Compliance Score'],
      ...data.map((point) =>
        'complianceScore' in point ? [point.date, point.complianceScore] : [point.date],
      ),
    ]);
  }

  if ('feeAmount' in first) {
    return buildCsv([
      ['Date', 'Fee Amount'],
      ...data.map((point) => ('feeAmount' in point ? [point.date, point.feeAmount] : [point.date])),
    ]);
  }

  return '';
}

export function buildHealthMetricsCsv(data: readonly HealthMetricsPoint[]): Blob {
  return new Blob([buildHealthMetricsCsvContent(data)], {
    type: 'text/csv;charset=utf-8',
  });
}

export function buildHealthMetricsFilename(metric = 'health-metrics'): string {
  return `${sanitizeExportFilename(metric)}.csv`;
}

export function buildAttestationCsvRows(attestations: readonly AttestationExportRow[]): string[][] {
  return attestations.map((attestation) => [
    attestation.id,
    attestation.title,
    attestation.description,
    attestation.txHash,
    formatTimestamp(attestation.timestamp),
    attestation.severity,
  ]);
}

export function buildAttestationCsvContent(attestations: readonly AttestationExportRow[]): string {
  return buildCsv([
    ['ID', 'Title', 'Description', 'Transaction Hash', 'Timestamp', 'Severity'],
    ...buildAttestationCsvRows(attestations),
  ]);
}

export function buildAttestationExportFilename(commitmentId = 'commitment'): string {
  return `${sanitizeExportFilename(commitmentId)}-attestations.csv`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') {
    throw new Error('Blob downloads require a browser environment.');
  }

  const url = URL.createObjectURL(blob);

  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = sanitizeExportFilename(filename);
    anchor.style.display = 'none';

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadCsvContent(content: string, filename: string): void {
  const blob = new Blob([content], {
    type: 'text/csv;charset=utf-8',
  });

  downloadBlob(blob, filename);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${src}`));

    image.src = src;
  });
}

export async function exportSvgElementToPng(
  svgElement: SVGElement,
  filename = 'chart.png',
): Promise<void> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgElement);
  const svgBlob = new Blob([svgString], {
    type: 'image/svg+xml;charset=utf-8',
  });

  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);

    const rect = svgElement.getBoundingClientRect();
    const width = Number(svgElement.getAttribute('width')) || rect.width || 800;
    const height = Number(svgElement.getAttribute('height')) || rect.height || 600;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas 2D context is unavailable.');
    }

    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create PNG blob.'));
        }
      }, 'image/png');
    });

    downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export async function exportChartContainerToPng(
  container: HTMLElement,
  filename = 'chart.png',
): Promise<void> {
  const svgElement = container.querySelector('svg');

  if (!svgElement) {
    throw new Error('Chart SVG element was not found.');
  }

  await exportSvgElementToPng(svgElement, filename);
}
