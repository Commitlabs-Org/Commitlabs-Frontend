'use client';

import React, { useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';

import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';
import type { CommitmentExposureResult } from '../../utils/exposure';
import {
  CHART_COLORS,
  CHART_GRID_PROPS,
  CHART_LEGEND_LAYOUT,
  CHART_MARGIN_DEFAULT,
  CHART_TOOLTIP_CURSOR_BAR,
  CHART_X_AXIS_PROPS,
  CHART_Y_AXIS_PROPS,
  formatPlainNumberTick,
} from './chartConfig';

export interface HealthMetricsFeeGenerationChartProps {
  data: Array<{ date: string; feeAmount: number }>;
  exposure?: CommitmentExposureResult;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: { date: string; feeAmount: number };
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: TooltipPayload) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg">
        <p className="text-[#99a1af] text-sm mb-1">{label}</p>
        <p className="text-[#0ff0fc] text-sm font-medium">
          Fees: ${(entry?.value ?? 0).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

const HealthMetricsFeeGenerationChartComponent: React.FC<HealthMetricsFeeGenerationChartProps> = ({
  data,
  exposure,
}) => {
  const yTickFormatter = useCallback((value: number) => formatPlainNumberTick(value), []);

  const renderLegend = useCallback(
    () => (
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="w-3 h-3 rounded-sm bg-[#0ff0fc]" />
        <span className="text-[#0ff0fc] text-sm">Fees ($)</span>
      </div>
    ),
    [],
  );

  const barCells = useMemo(
    () => data.map((_, index) => <Cell key={`cell-${index}`} filter="url(#feeBarGlow)" />),
    [data],
  );

  return (
    <>
      <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={CHART_MARGIN_DEFAULT} barCategoryGap="20%">
            <defs>
              <linearGradient id="feeBarGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={1} />
                <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.7} />
              </linearGradient>
              <filter id="feeBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid {...CHART_GRID_PROPS} />
            <XAxis {...CHART_X_AXIS_PROPS} />
            <YAxis {...CHART_Y_AXIS_PROPS} tickFormatter={yTickFormatter} />
            <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR_BAR} />
            <Legend {...CHART_LEGEND_LAYOUT} content={renderLegend} />
            <Bar
              dataKey="feeAmount"
              fill="url(#feeBarGradient)"
              radius={[4, 4, 0, 0]}
              maxBarSize={60}
            >
              {barCells}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 pt-4 border-t border-[#222]">
          <p className="text-[#99a1af] text-sm leading-relaxed text-center sm:text-left">
            View fees generated over the commitment period from yield and protocol incentives.
          </p>
        </div>
      </div>

      {exposure && (
        <div className="mt-4">
          <VolatilityExposureMeter
            valuePercent={exposure.exposurePercent ?? 0}
            description="Current exposure to volatile assets based on allocation and market conditions."
          />
        </div>
      )}
    </>
  );
};

export const HealthMetricsFeeGenerationChart = React.memo(HealthMetricsFeeGenerationChartComponent);
HealthMetricsFeeGenerationChart.displayName = 'HealthMetricsFeeGenerationChart';
