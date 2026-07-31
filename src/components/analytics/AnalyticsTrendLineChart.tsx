'use client';

import React from 'react';
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

export interface TrendDataPoint {
  label: string;
  value: number;
}

export interface AnalyticsTrendLineChartProps {
  /** Chart title shown above the chart */
  title: string;
  /** Series of data points */
  data: TrendDataPoint[];
  /** Label for the value axis / legend */
  seriesLabel?: string;
  /** Color of the line, defaults to teal brand colour */
  color?: string;
  /** Format function applied to tooltip values */
  valueFormatter?: (v: number) => string;
  /** Accessible description of what the chart shows */
  description?: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}

function defaultFormatter(v: number): string {
  return v.toLocaleString();
}

const CustomTooltip: React.FC<TooltipPayload & { formatter: (v: number) => string }> = ({
  active,
  payload,
  label,
  formatter,
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg min-w-[140px]">
      <p className="text-[#99a1af] text-xs mb-1">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300 text-sm font-medium">
            {entry.name}: {formatter(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

/**
 * AnalyticsTrendLineChart
 *
 * A Recharts-based line chart for displaying a single metric trend over time.
 * Provides an accessible fallback table for screen readers and users who
 * prefer text alternatives to visual data.
 */
const AnalyticsTrendLineChart: React.FC<AnalyticsTrendLineChartProps> = ({
  title,
  data,
  seriesLabel = 'Value',
  color = '#0ff0fc',
  valueFormatter = defaultFormatter,
  description,
}) => {
  const hasData = data.length > 0;

  return (
    <section
      aria-label={title}
      className="w-full bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-sm"
    >
      <h3 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">{title}</h3>

      {description && <p className="text-[#99a1af] text-xs mb-4">{description}</p>}

      {hasData ? (
        <>
          {/* Visual chart */}
          <div aria-hidden="true">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="#666"
                  tick={{ fill: '#666', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  dy={8}
                />
                <YAxis
                  stroke="#666"
                  tick={{ fill: '#666', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={valueFormatter}
                />
                <Tooltip
                  content={<CustomTooltip formatter={valueFormatter} />}
                  cursor={{ stroke: '#333' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  content={() => (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs" style={{ color }}>
                        {seriesLabel}
                      </span>
                    </div>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={seriesLabel}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color, stroke: '#111', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: color, stroke: '#111', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Accessible text table (visually hidden, readable by screen readers) */}
          <table className="sr-only" aria-label={`${title} data table`}>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">{seriesLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point, i) => (
                <tr key={i}>
                  <td>{point.label}</td>
                  <td>{valueFormatter(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <div className="flex items-center justify-center h-[220px]">
          <p className="text-[#555] text-sm">No trend data available yet.</p>
        </div>
      )}
    </section>
  );
};

export default AnalyticsTrendLineChart;
