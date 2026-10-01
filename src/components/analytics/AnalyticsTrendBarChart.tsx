'use client';

import React from 'react';
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

export interface BarDataPoint {
  label: string;
  value: number;
}

export interface AnalyticsTrendBarChartProps {
  /** Chart title shown above the chart */
  title: string;
  /** Series of data points */
  data: BarDataPoint[];
  /** Label for the bars / legend */
  seriesLabel?: string;
  /** Bar fill colour, defaults to teal brand colour */
  color?: string;
  /** Format function applied to tooltip values */
  valueFormatter?: (v: number) => string;
  /** Accessible description of what the chart shows */
  description?: string;
}

interface TooltipPayload {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
}

function defaultFormatter(v: number): string {
  return v.toLocaleString();
}

const CustomTooltip: React.FC<
  TooltipPayload & { formatter: (v: number) => string; color: string }
> = ({ active, payload, label, formatter, color }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg min-w-[140px]">
      <p className="text-[#99a1af] text-xs mb-1">{label}</p>
      <p className="text-sm font-medium" style={{ color }}>
        {payload[0].name}: {formatter(payload[0].value)}
      </p>
    </div>
  );
};

/**
 * AnalyticsTrendBarChart
 *
 * A Recharts-based bar chart for displaying a single categorical metric.
 * Provides an accessible fallback table for screen readers.
 */
const AnalyticsTrendBarChart: React.FC<AnalyticsTrendBarChartProps> = ({
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
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                barCategoryGap="20%"
              >
                <defs>
                  <linearGradient
                    id={`barGrad-${title.replace(/\s/g, '')}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.65} />
                  </linearGradient>
                </defs>
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
                  content={<CustomTooltip formatter={valueFormatter} color={color} />}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  content={() => (
                    <div className="flex items-center justify-center gap-2 mt-3">
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                      <span className="text-xs" style={{ color }}>
                        {seriesLabel}
                      </span>
                    </div>
                  )}
                />
                <Bar
                  dataKey="value"
                  name={seriesLabel}
                  fill={`url(#barGrad-${title.replace(/\s/g, '')})`}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={60}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Accessible text table (visually hidden, readable by screen readers) */}
          <table className="sr-only" aria-label={`${title} data table`}>
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Category</th>
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
          <p className="text-[#555] text-sm">No data available yet.</p>
        </div>
      )}
    </section>
  );
};

export default AnalyticsTrendBarChart;
