'use client';

import React, { useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
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
} from './chartConfig';

export interface HealthMetricsComplianceChartProps {
  data: Array<{ date: string; complianceScore: number }>;
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
        <p className="text-[#4ADE80] text-sm font-medium">Score: {entry?.value}</p>
      </div>
    );
  }
  return null;
};

const HealthMetricsComplianceChartComponent: React.FC<HealthMetricsComplianceChartProps> = ({
  data,
}) => {
  const renderLegend = useCallback(
    () => (
      <div className="flex items-center justify-center gap-2 mt-4">
        <div className="w-3 h-3 rounded-full bg-[#4ADE80]" />
        <span className="text-[#99a1af] text-sm">Compliance Score</span>
      </div>
    ),
    [],
  );

  return (
    <div className="w-full h-full min-h-[300px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222]">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={CHART_MARGIN_COMPACT}>
          <CartesianGrid {...CHART_GRID_PROPS} />
          <XAxis {...CHART_X_AXIS_PROPS} />
          <YAxis {...CHART_Y_AXIS_PROPS} domain={[0, 100]} />
          <Tooltip content={<CustomTooltip />} cursor={CHART_TOOLTIP_CURSOR_LINE} />
          <Legend {...CHART_LEGEND_LAYOUT} content={renderLegend} />
          <Line
            type="monotone"
            dataKey="complianceScore"
            stroke={CHART_COLORS.green}
            strokeWidth={2}
            dot={{ ...CHART_DOT, fill: CHART_COLORS.green }}
            activeDot={{ r: CHART_ACTIVE_DOT_R, fill: CHART_COLORS.green }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-4 pt-4 border-t border-[#222]">
        <p className="text-[#99a1af] text-sm leading-relaxed">
          Historical compliance score showing how well the commitment has adhered to its rules.
        </p>
      </div>
    </div>
  );
};

export const HealthMetricsComplianceChart = React.memo(HealthMetricsComplianceChartComponent);
HealthMetricsComplianceChart.displayName = 'HealthMetricsComplianceChart';
