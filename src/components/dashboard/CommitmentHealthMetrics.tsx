"use client";

import React, { useMemo, useRef, useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import dynamic from "next/dynamic";
import { TrendingUp, TrendingDown, DollarSign, CheckCircle } from "lucide-react";
import HealthMetricsSkeleton from "../HealthMetricsSkeleton";
import { ChartExportMenu } from "./ChartExportMenu";
import type { HealthMetricsExportData } from "@/utils/chartExport";
import HealthMetricsRangeSelector, { type RangeKey } from "./HealthMetricsRangeSelector";
import { useHealthMetricsRange } from "./useHealthMetricsRange";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const HealthMetricsValueHistoryChart = dynamic(
  () => import("./HealthMetricsValueHistoryChart").then((mod) => mod.HealthMetricsValueHistoryChart),
  { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsDrawdownChart = dynamic(
  () => import("./HealthMetricsDrawdownChart").then((mod) => mod.HealthMetricsDrawdownChart),
  { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsFeeGenerationChart = dynamic(
  () => import("./HealthMetricsFeeGenerationChart").then((mod) => mod.HealthMetricsFeeGenerationChart),
  { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsComplianceChart = dynamic(
  () => import("./HealthMetricsComplianceChart").then((mod) => mod.HealthMetricsComplianceChart),
  { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

export interface TimeSeriesPoint {
  date: string;
  value?: number;
  currentValue?: number;
  initialAmount?: number;
  drawdownPercent?: number;
  feeAmount?: number;
  complianceScore?: number;
}

export interface BenchmarkPoint {
  date: string;
  benchmarkValue: number;
}

type TabType = "value" | "drawdown" | "fee" | "compliance";

const tabIcons: Record<TabType, React.ReactNode> = {
  value: <TrendingUp size={16} />,
  drawdown: <TrendingDown size={16} />,
  fee: <DollarSign size={16} />,
  compliance: <CheckCircle size={16} />,
};

const TABS: Array<{ id: TabType; label: string }> = [
  { id: "value", label: "Value History" },
  { id: "drawdown", label: "Drawdown" },
  { id: "fee", label: "Fee Generation" },
  { id: "compliance", label: "Compliance" },
];

const EmptyChart: React.FC<{ rangeLabel: string }> = ({ rangeLabel }) => (
  <div
    className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-[#222] bg-[#111] text-center text-[#99a1af]"
    data-testid="empty-chart-message"
    role="status"
    aria-live="polite"
  >
    <p className="text-sm font-medium">No data for the last {rangeLabel}</p>
    <p className="mt-1 text-xs">Try selecting a wider range.</p>
  </div>
);

function normalizeDate(value: string | Date | number): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatRangeLabel(range: RangeKey): string {
  return range === "all" ? "full history" : `${range.replace("d", " days")}`;
}

interface CommitmentHealthMetricsProps {
  commitmentId: string;
  complianceData: TimeSeriesPoint[];
  drawdownData: TimeSeriesPoint[];
  valueHistoryData: TimeSeriesPoint[];
  feeGenerationData: TimeSeriesPoint[];
  thresholdPercent?: number;
  volatilityPercent?: number;
  isLoading?: boolean;
  /** Lifecycle event annotations passed through to both value-history and drawdown charts. */
  lifecycleEvents?: import('./HealthMetricsDrawdownChart').LifecycleEvent[];
}

export default function CommitmentHealthMetrics({
  commitmentId,
  complianceData,
  drawdownData,
  valueHistoryData,
  feeGenerationData,
  thresholdPercent,
  volatilityPercent,
  isLoading = false,
  lifecycleEvents,
}: CommitmentHealthMetricsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("value");
  const { selectedRange, setRange, filterByRange } = useHealthMetricsRange();
  const [showBenchmark, setShowBenchmark] = useState(true);

  const valueChartRef = useRef<HTMLDivElement>(null);
  const drawdownChartRef = useRef<HTMLDivElement>(null);
  const feeChartRef = useRef<HTMLDivElement>(null);
  const complianceChartRef = useRef<HTMLDivElement>(null);

  const rangeLabel = useMemo(() => formatRangeLabel(selectedRange), [selectedRange]);

  const filteredValueHistory = useMemo(
    () => filterByRange(valueHistoryData, (point) => normalizeDate(point.date)),
    [filterByRange, valueHistoryData]
  );
  const filteredDrawdownHistory = useMemo(
    () => filterByRange(drawdownData, (point) => normalizeDate(point.date)),
    [filterByRange, drawdownData]
  );
  const filteredFeeGenerationHistory = useMemo(
    () => filterByRange(feeGenerationData, (point) => normalizeDate(point.date)),
    [filterByRange, feeGenerationData]
  );
  const filteredComplianceHistory = useMemo(
    () => filterByRange(complianceData, (point) => normalizeDate(point.date)),
    [filterByRange, complianceData]
  );

  // Export menu always exports the full (unfiltered) dataset, not just the active range.
  const exportData: HealthMetricsExportData = {
    complianceData,
    drawdownData,
    valueHistoryData,
    feeGenerationData,
  };

  const hasBenchmark = benchmarkData && benchmarkData.length > 0;

  return (
    <div className="w-full bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <h2 className="text-2xl font-semibold text-white">Health Metrics</h2>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <HealthMetricsRangeSelector selected={selectedRange} onChange={setRange} />

          {/* Benchmark toggle — only shown on value tab when benchmark data is available */}
          {activeTab === "value" && hasBenchmark && (
            <button
              type="button"
              aria-pressed={showBenchmark}
              onClick={() => setShowBenchmark((v) => !v)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                showBenchmark
                  ? "bg-[#f5a623]/10 border-[#f5a623]/40 text-[#f5a623]"
                  : "bg-transparent border-[#333] text-[#8892a0] hover:border-[#555]"
              )}
            >
              <span className="w-2 h-2 rounded-full bg-[#f5a623]" aria-hidden="true" />
              {showBenchmark ? "Hide" : "Show"} {benchmarkLabel}
            </button>
          )}

          <div className="flex flex-wrap gap-2 p-1 bg-[#111] rounded-lg border border-[#222]">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-[#222] text-[#0ff0fc] shadow-sm"
                    : "text-[#8892a0] hover:text-[#99a1af] hover:bg-[#1a1a1a]"
                )}
              >
                {tabIcons[tab.id]}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full">
        {activeTab === "value" && (
          <div id="tabpanel-value" className="relative" ref={valueChartRef}>
            <ChartExportMenu
              commitmentId={commitmentId}
              tab="value"
              data={exportData}
              disabled={isLoading}
              chartContainerRef={valueChartRef}
            />
            {filteredValueHistory.length === 0 ? (
              <EmptyChart rangeLabel={rangeLabel} />
            ) : (
              <HealthMetricsValueHistoryChart
                data={filteredValueHistory as Array<{ date: string; currentValue: number; initialAmount?: number }>}
                volatilityPercent={volatilityPercent}
                lifecycleEvents={lifecycleEvents}
              />
            )}
          </div>
        )}

        {activeTab === "drawdown" && (
          <div id="tabpanel-drawdown" className="relative" ref={drawdownChartRef}>
            <ChartExportMenu
              commitmentId={commitmentId}
              tab="drawdown"
              data={exportData}
              disabled={isLoading}
              chartContainerRef={drawdownChartRef}
            />
            {filteredDrawdownHistory.length === 0 ? (
              <EmptyChart rangeLabel={rangeLabel} />
            ) : (
              <HealthMetricsDrawdownChart
                data={filteredDrawdownHistory as Array<{ date: string; drawdownPercent: number }>}
                thresholdPercent={thresholdPercent}
                volatilityPercent={volatilityPercent}
                lifecycleEvents={lifecycleEvents}
              />
            )}
          </div>
        )}

        {activeTab === "fee" && (
          <div id="tabpanel-fee" className="relative" ref={feeChartRef}>
            <ChartExportMenu
              commitmentId={commitmentId}
              tab="fee"
              data={exportData}
              disabled={isLoading}
              chartContainerRef={feeChartRef}
            />
            {filteredFeeGenerationHistory.length === 0 ? (
              <EmptyChart rangeLabel={rangeLabel} />
            ) : (
              <HealthMetricsFeeGenerationChart
                data={filteredFeeGenerationHistory as Array<{ date: string; feeAmount: number }>}
                volatilityPercent={volatilityPercent}
              />
            )}
          </div>
        )}

        {activeTab === "compliance" && (
          <div id="tabpanel-compliance" className="relative" ref={complianceChartRef}>
            <ChartExportMenu
              commitmentId={commitmentId}
              tab="compliance"
              data={exportData}
              disabled={isLoading}
              chartContainerRef={complianceChartRef}
            />
            {filteredComplianceHistory.length === 0 ? (
              <EmptyChart rangeLabel={rangeLabel} />
            ) : (
              <HealthMetricsComplianceChart
                data={filteredComplianceHistory as Array<{ date: string; complianceScore: number }>}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
