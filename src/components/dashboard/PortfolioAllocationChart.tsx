'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Commitment } from '@/lib/types/domain';
import {
  aggregateByRiskProfile,
  aggregateByAsset,
  type AllocationSlice,
  formatAllocationValue,
} from '@/utils/portfolioAllocation';

type ViewMode = 'risk' | 'asset';

const VIEW_LABELS: Record<ViewMode, string> = {
  risk: 'By Risk Profile',
  asset: 'By Asset',
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const entry = payload[0];
    return (
      <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg">
        <p className="text-white text-sm font-medium mb-1">{entry?.name}</p>
        <p className="text-[#99a1af] text-sm">
          {formatAllocationValue(entry?.value ?? 0)}
        </p>
      </div>
    );
  }
  return null;
};

interface PortfolioAllocationChartProps {
  commitments: Commitment[];
}

export function PortfolioAllocationChartInner({
  commitments,
}: PortfolioAllocationChartProps) {
  const [view, setView] = useState<ViewMode>('risk');

  const slices: AllocationSlice[] = React.useMemo(
    () =>
      view === 'risk'
        ? aggregateByRiskProfile(commitments)
        : aggregateByAsset(commitments),
    [commitments, view],
  );

  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (commitments.length === 0) {
    return (
      <div
        className="bg-[#111] border border-[#222] rounded-xl p-6 text-center"
        role="status"
      >
        <h3 className="text-lg font-medium text-white mb-2">
          No Portfolio Data
        </h3>
        <p className="text-[#99a1af] text-sm">
          Create a commitment to see your portfolio allocation here.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white">
          Portfolio Allocation
        </h2>
        <div className="flex gap-1 p-0.5 bg-[#0a0a0a] rounded-lg border border-[#222]">
          {(Object.entries(VIEW_LABELS) as [ViewMode, string][]).map(
            ([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
                  view === key
                    ? 'bg-[#222] text-[#0ff0fc] shadow-sm'
                    : 'text-[#8892a0] hover:text-[#99a1af]'
                }`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="w-64 h-64 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {slices.map((_entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={slices[index]?.color ?? '#666'}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1 w-full">
          <div className="space-y-2">
            {slices.map((slice) => (
              <div key={slice.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-sm text-[#99a1af]">{slice.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-white font-medium">
                    {formatAllocationValue(slice.value)}
                  </p>
                  <p className="text-xs text-[#8892a0]">
                    {total > 0
                      ? ((slice.value / total) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <table
        className="sr-only"
        aria-label={`Portfolio allocation by ${view === 'risk' ? 'risk profile' : 'asset'}`}
      >
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Allocated Amount</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={slice.name}>
              <td>{slice.name}</td>
              <td>{formatAllocationValue(slice.value)}</td>
              <td>
                {total > 0
                  ? ((slice.value / total) * 100).toFixed(1)
                  : '0.0'}
                %
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
