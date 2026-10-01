'use client';

import React, { useCallback, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import type { LifecycleEvent } from './HealthMetricsDrawdownChart';

import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';
import { useReducedMotion } from '../../lib/a11y/useReducedMotion';
import type { CommitmentExposureResult } from '../../utils/exposure';
import {
  CHART_ACTIVE_DOT_R,
  CHART_COLORS,
  CHART_DOT,
  CHART_GRID_PROPS,
  CHART_LEGEND_LAYOUT,
  CHART_MARGIN_DEFAULT,
  CHART_TOOLTIP_CURSOR_LINE,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  LIFECYCLE_REF_LINE,
  formatLocaleNumber,
  normalizeChartData,
} from './chartConfig';
import { downsampleSeries } from '../../utils/downsample';

export interface HealthMetricsValueHistoryChartProps {
  data: Array<{ date: string; currentValue: number; initialAmount?: number }>;
  volatilityPercent?: number;
  /** Vertical annotation lines for lifecycle events. */
  lifecycleEvents?: LifecycleEvent[];
  exposure?: CommitmentExposureResult;
  benchmarkData?: Array<{ date: string; benchmarkValue: number }>;
  benchmarkLabel?: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    name: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipPayload) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg min-w-[150px]">
        <p className="text-[#99a1af] text-sm mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-300 text-sm font-medium">
              {entry.name}: {entry.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const HealthMetricsValueHistoryChartComponent: React.FC<HealthMetricsValueHistoryChartProps> = ({
  data,
  volatilityPercent,
  lifecycleEvents = [],
  exposure,
  benchmarkData,
  benchmarkLabel,
}) => {
  const reducedMotion = useReducedMotion();
  const safeData = useMemo(() => normalizeChartData(data), [data]);

  const hasBenchmark = Boolean(safeBenchmarkData.length > 0);

  const benchmarkByDate = useMemo(() => {
    if (!hasBenchmark || !benchmarkData) return {};
    return Object.fromEntries(
      normalizeChartData(benchmarkData).map((p) => [p.date, p.benchmarkValue]),
    );
  }, [benchmarkData, hasBenchmark]);

  const mergedData = useMemo(() => {
    if (!hasBenchmark) return safeData;
    return safeData.map((point) => ({
      ...point,
      benchmarkValue: benchmarkByDate[point.date] ?? null,
    }));
  }, [safeData, hasBenchmark, benchmarkByDate]);

  const yTickFormatter = useCallback((value: number) => formatLocaleNumber(value), []);

  const renderLegend = useCallback(
    () => (
      <div className="flex items-center justify-center gap-6 mt-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#0ff0fc]" />
          <span className="text-[#0ff0fc] text-sm">Current Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border-2 border-[#666] border-dashed" />
          <span className="text-[#8892a0] text-sm">Initial Amount</span>
        </div>
        {hasBenchmark && (
          <div className="flex items-center gap-2" aria-label={`${benchmarkLabel} overlay`}>
            <div className="w-3 h-3 rounded-full bg-[#f5a623]" />
            <span className="text-[#f5a623] text-sm">{benchmarkLabel}</span>
          </div>
        )}
      </div>
    ),
    [hasBenchmark, benchmarkLabel],
  );

  const showMeter =
    Boolean(exposure) ||
    (typeof volatilityPercent === 'number' && Number.isFinite(volatilityPercent));
  const meterPercent =
    exposure?.exposurePercent ?? (typeof volatilityPercent === 'number' ? volatilityPercent : 0);

  return (
    <>
      <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-sm">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={boundedData} margin={CHART_MARGIN_DEFAULT}>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis {...CHART_X_AXIS_PROPS} />
            <YAxis {...CHART_Y_AXIS_PROPS} tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR_LINE} />
            <Legend {...CHART_LEGEND_LAYOUT} content={renderLegend} />
            {lifecycleEvents.map((ev) => (
              <ReferenceLine
                key={ev.date}
                x={ev.date}
                stroke={ev.color ?? LIFECYCLE_REF_LINE.defaultColor}
                strokeWidth={LIFECYCLE_REF_LINE.strokeWidth}
                strokeDasharray={LIFECYCLE_REF_LINE.strokeDasharray}
                label={{
                  value: ev.label,
                  position: 'top',
                  fill: ev.color ?? LIFECYCLE_REF_LINE.defaultColor,
                  fontSize: LIFECYCLE_REF_LINE.labelFontSize,
                }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="initialAmount"
              name="Initial Amount"
              stroke={CHART_COLORS.muted}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              activeDot={false}
              isAnimationActive={!reducedMotion}
            />
            <Line
              type="monotone"
              dataKey="currentValue"
              name="Current Value"
              stroke={CHART_COLORS.teal}
              strokeWidth={2}
              dot={{ ...CHART_DOT, fill: CHART_COLORS.teal }}
              activeDot={{
                r: CHART_ACTIVE_DOT_R,
                fill: CHART_COLORS.teal,
                stroke: CHART_COLORS.surface,
                strokeWidth: 2,
              }}
              isAnimationActive={!reducedMotion}
            />
            {hasBenchmark && (
              <Line
                type="monotone"
                dataKey="benchmarkValue"
                name={benchmarkLabel}
                stroke={CHART_COLORS.benchmark}
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: CHART_COLORS.benchmark,
                  stroke: CHART_COLORS.surface,
                  strokeWidth: 2,
                }}
                isAnimationActive={!reducedMotion}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-[#222]">
          <p className="text-[#99a1af] text-sm leading-relaxed text-center sm:text-left">
            Track how your commitment value has changed over time compared to the initial amount.
            {hasBenchmark && ` The ${benchmarkLabel} overlay provides a reference for comparison.`}
          </p>
        </div>
      </div>

      {showMeter && (
        <div className="mt-4">
          <VolatilityExposureMeter
            valuePercent={meterPercent}
            description="Current exposure to volatile assets based on allocation and market conditions."
          />
        </div>
      )}
    </>
  );
};

export const HealthMetricsValueHistoryChart = React.memo(HealthMetricsValueHistoryChartComponent);
HealthMetricsValueHistoryChart.displayName = 'HealthMetricsValueHistoryChart';
