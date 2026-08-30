'use client';

import React, { useCallback, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';
import type { CommitmentExposureResult } from '../../utils/exposure';
import { downsampleSeries } from '../../utils/downsample';
import {
  CHART_ACTIVE_DOT_R,
  CHART_COLORS,
  CHART_DOT,
  CHART_GRID_PROPS,
  CHART_LEGEND_LAYOUT,
  CHART_MARGIN_COMPACT,
  CHART_TOOLTIP_CURSOR_LINE,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  LIFECYCLE_REF_LINE,
  formatDrawdownAxisTick,
  normalizeChartData,
} from './chartConfig';

export interface LifecycleEvent {
  /** Date string matching a point in the chart data (e.g. "2024-01"). */
  date: string;
  /** Short label shown on the annotation line (e.g. "Inception", "Rebalance"). */
  label: string;
  /** Optional colour override. Defaults to amber (#F59E0B). */
  color?: string;
}

export interface HealthMetricsDrawdownChartProps {
  data: Array<{ date: string; drawdownPercent: number }>;
  thresholdPercent?: number;
  volatilityPercent?: number;
  /** Vertical annotation lines for lifecycle events (inception, rebalances, etc.). */
  lifecycleEvents?: LifecycleEvent[];
  exposure?: CommitmentExposureResult;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{
    value: number;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipPayload) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg">
        <p className="text-[#99a1af] text-sm mb-1">{label}</p>
        <p className="text-[#f87171] text-sm font-medium">
          Drawdown: {((entry?.value ?? 0) * 100).toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

const HealthMetricsDrawdownChartComponent: React.FC<HealthMetricsDrawdownChartProps> = ({
  data,
  thresholdPercent,
  volatilityPercent,
  lifecycleEvents = [],
  exposure,
}) => {
  const safeData = React.useMemo(() => normalizeChartData(data), [data]);
  const yTickFormatter = useCallback((value: number) => formatDrawdownAxisTick(value), []);

  const renderLegend = useCallback(
    () => (
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="w-3 h-3 rounded-full bg-[#DC2626]" />
        <span className="text-[#99a1af] text-sm">Drawdown %</span>
      </div>
    ),
    [],
  );

  const showMeter =
    Boolean(exposure) ||
    (typeof volatilityPercent === 'number' && Number.isFinite(volatilityPercent));
  const meterPercent =
    exposure?.exposurePercent ?? (typeof volatilityPercent === 'number' ? volatilityPercent : 0);

  const boundedData = useMemo(() => downsampleSeries(data), [data]);

  return (
    <>
      <div className="w-full h-full min-h-[300px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222]">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={safeData} margin={CHART_MARGIN_COMPACT}>
            <defs>
              <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.red} stopOpacity={0.8} />
                <stop offset="95%" stopColor={CHART_COLORS.red} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis {...CHART_X_AXIS_PROPS} />
            <YAxis {...CHART_Y_AXIS_PROPS} domain={[0, 1]} tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR_LINE} />
            <Legend {...CHART_LEGEND_LAYOUT} content={renderLegend} />
            {thresholdPercent !== undefined && (
              <ReferenceLine
                y={thresholdPercent}
                stroke={CHART_COLORS.red}
                strokeDasharray="5 5"
                strokeWidth={2}
                opacity={0.6}
              />
            )}
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
            <Area
              type="monotone"
              dataKey="drawdownPercent"
              stroke={CHART_COLORS.red}
              strokeWidth={2}
              fill="url(#drawdownGradient)"
              dot={{ ...CHART_DOT, fill: CHART_COLORS.red }}
              activeDot={{ r: CHART_ACTIVE_DOT_R, fill: CHART_COLORS.red }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-[#222]">
          <p className="text-[#99a1af] text-sm leading-relaxed">
            Monitor the maximum loss from peak value. Red line shows current drawdown, dashed line
            is your threshold.
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

export const HealthMetricsDrawdownChart = React.memo(HealthMetricsDrawdownChartComponent);
HealthMetricsDrawdownChart.displayName = 'HealthMetricsDrawdownChart';
