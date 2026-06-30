'use client';

import { useState } from 'react';
import { Download, Image as ImageIcon, FileJson } from 'lucide-react';
import {
  buildHealthMetricsCsvContent,
  buildHealthMetricsFilename,
  downloadCsvContent,
  downloadBlob,
  exportChartContainerToPng,
  type HealthMetricsExportData,
  type HealthMetricsTab,
} from '@/utils/chartExport';

interface ChartExportMenuProps {
  commitmentId: string;
  tab: HealthMetricsTab;
  data: HealthMetricsExportData;
  disabled?: boolean;
  chartContainerRef: React.RefObject<HTMLElement | null>;
}

function getTabData(tab: HealthMetricsTab, data: HealthMetricsExportData) {
  switch (tab) {
    case 'value':    return data.valueHistoryData;
    case 'drawdown': return data.drawdownData;
    case 'fee':      return data.feeGenerationData;
    case 'compliance': return data.complianceData;
  }
}

export function ChartExportMenu({
  commitmentId,
  tab,
  data,
  disabled = false,
  chartContainerRef,
}: ChartExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleCsvExport = async () => {
    if (disabled || isExporting) return;
    setIsExporting(true);
    try {
      const csv = buildHealthMetricsCsvContent(tab, data);
      const filename = buildHealthMetricsFilename(commitmentId, tab, 'csv');
      await downloadCsvContent(csv, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePngExport = async () => {
    if (disabled || isExporting) return;
    const container = chartContainerRef.current;
    if (!container) return;

    setIsExporting(true);
    try {
      const filename = buildHealthMetricsFilename(commitmentId, tab, 'png');
      await exportChartContainerToPng(container, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const handleJsonExport = async () => {
    if (disabled || isExporting) return;
    setIsExporting(true);
    try {
      const rows = getTabData(tab, data);
      const json = JSON.stringify({ tab, exportedAt: new Date().toISOString(), rows }, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const filename = buildHealthMetricsFilename(commitmentId, tab, 'json' as 'csv');
      await downloadBlob(blob, filename);
    } finally {
      setIsExporting(false);
    }
  };

  const btnClass =
    'focus-ring inline-flex items-center gap-1.5 rounded-md border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#99a1af] hover:text-white disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      <button
        type="button"
        className={btnClass}
        onClick={handleCsvExport}
        disabled={disabled || isExporting}
        aria-label={`Export ${tab} chart data as CSV`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        CSV
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={handlePngExport}
        disabled={disabled || isExporting}
        aria-label={`Export ${tab} chart as PNG`}
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        PNG
      </button>
      <button
        type="button"
        className={btnClass}
        onClick={handleJsonExport}
        disabled={disabled || isExporting}
        aria-label={`Export ${tab} chart data as JSON`}
      >
        <FileJson className="h-3.5 w-3.5" aria-hidden="true" />
        JSON
      </button>
    </div>
  );
}
