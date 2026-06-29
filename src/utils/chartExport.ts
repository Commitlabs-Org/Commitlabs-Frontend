import { buildCsv, type CsvRow } from '@/lib/backend/csv';
import type { Attestation } from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';

export type HealthMetricsTab = 'value' | 'drawdown' | 'fee' | 'compliance';

export interface HealthMetricsExportData {
  valueHistoryData: Array<{ date: string; currentValue: number; initialAmount?: number }>;
  drawdownData: Array<{ date: string; drawdownPercent: number }>;
  feeGenerationData: Array<{ date: string; feeAmount: number }>;
  complianceData: Array<{ date: string; complianceScore: number }>;
}

const TAB_LABELS: Record<HealthMetricsTab, string> = {
  value: 'value-history',
  drawdown: 'drawdown',
  fee: 'fee-generation',
  compliance: 'compliance',
};

function normalizeDrawdownPercent(value: number): string {
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(2)}%`;
}

export function buildHealthMetricsCsv(
  tab: HealthMetricsTab,
  data: HealthMetricsExportData,
): { headers: string[]; rows: CsvRow[] } {
  switch (tab) {
    case 'value':
      return {
        headers: ['Date', 'Current Value', 'Initial Amount'],
        rows: data.valueHistoryData.map((row) => [
          row.date,
          String(row.currentValue),
          row.initialAmount == null ? '' : String(row.initialAmount),
        ]),
      };
    case 'drawdown':
      return {
        headers: ['Date', 'Drawdown Percent'],
        rows: data.drawdownData.map((row) => [
          row.date,
          normalizeDrawdownPercent(row.drawdownPercent),
        ]),
      };
    case 'fee':
      return {
        headers: ['Date', 'Fee Amount'],
        rows: data.feeGenerationData.map((row) => [row.date, String(row.feeAmount)]),
      };
    case 'compliance':
      return {
        headers: ['Date', 'Compliance Score'],
        rows: data.complianceData.map((row) => [row.date, String(row.complianceScore)]),
      };
    default:
      return { headers: [], rows: [] };
  }
}

export function buildHealthMetricsCsvContent(
  tab: HealthMetricsTab,
  data: HealthMetricsExportData,
): string {
  const { headers, rows } = buildHealthMetricsCsv(tab, data);
  return buildCsv(headers, rows);
}

export function sanitizeExportFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function buildHealthMetricsFilename(
  commitmentId: string,
  tab: HealthMetricsTab,
  extension: 'csv' | 'png',
): string {
  const safeId = sanitizeExportFilename(commitmentId || 'commitment');
  const metric = TAB_LABELS[tab];
  const dateStamp = new Date().toISOString().slice(0, 10);
  return sanitizeExportFilename(`health-metrics-${safeId}-${metric}-${dateStamp}.${extension}`);
}

export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}

export async function downloadCsvContent(content: string, filename: string): Promise<void> {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  await downloadBlob(blob, filename);
}

export async function exportSvgElementToPng(
  svgElement: SVGSVGElement,
  filename: string,
): Promise<void> {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  if (!clonedSvg.getAttribute('xmlns')) {
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }

  const bbox = svgElement.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(bbox.width));
  const height = Math.max(1, Math.ceil(bbox.height));
  clonedSvg.setAttribute('width', String(width));
  clonedSvg.setAttribute('height', String(height));

  const serialized = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas context unavailable');
    }
    context.fillStyle = '#111111';
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    });

    await downloadBlob(pngBlob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function exportChartContainerToPng(
  container: HTMLElement,
  filename: string,
): Promise<void> {
  const svgElement = container.querySelector('svg.recharts-surface');
  if (!(svgElement instanceof SVGSVGElement)) {
    throw new Error('Chart SVG not found');
  }
  await exportSvgElementToPng(svgElement, filename);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load chart SVG for PNG export'));
    image.src = src;
  });
}

// ── Attestation CSV export helpers ──────────────────────────────────────────

export const ATTESTATION_CSV_HEADERS = ['ID', 'Title', 'Description', 'TX Hash', 'Timestamp', 'Severity'] as const;

export function buildAttestationCsvRows(attestations: Attestation[]): CsvRow[] {
  return attestations.map((a) => [
    a.id,
    a.title,
    a.description,
    a.txHash,
    typeof a.timestamp === 'string' ? a.timestamp : a.timestamp.toISOString(),
    a.severity,
  ]);
}

export function buildAttestationCsvContent(attestations: Attestation[]): string {
  return buildCsv(
    [...ATTESTATION_CSV_HEADERS],
    buildAttestationCsvRows(attestations),
  );
}

export function buildAttestationExportFilename(commitmentId: string): string {
  const safeId = sanitizeExportFilename(commitmentId || 'commitment');
  const dateStamp = new Date().toISOString().slice(0, 10);
  return sanitizeExportFilename(`attestations-${safeId}-${dateStamp}.csv`);
}
