'use client';

import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import {
  buildHealthMetricsCsvContent,
  buildHealthMetricsFilename,
  downloadCsvContent,
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

  return (
    <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
      <button
        type="button"
        className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#99a1af] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handleCsvExport}
        disabled={disabled || isExporting}
        aria-label={`Export ${tab} chart data as CSV`}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        CSV
      </button>
      <button
        type="button"
        className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-xs font-medium text-[#99a1af] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={handlePngExport}
        disabled={disabled || isExporting}
        aria-label={`Export ${tab} chart as PNG`}
      >
        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
        PNG
      </button>
    </div>
  );
}
