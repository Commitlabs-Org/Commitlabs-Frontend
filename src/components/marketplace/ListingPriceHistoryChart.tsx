'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

export interface PriceHistoryPoint {
  date: string;
  price: number;
}

interface ListingPriceHistoryChartProps {
  data: PriceHistoryPoint[];
  /** Currency label (e.g. "XLM", "USDC"). */
  currency?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-[#333] bg-[#1a1a1a] p-3 text-sm shadow-lg">
        <p className="mb-1 text-[#99a1af]">{label}</p>
        <p className="font-medium text-white">
          {payload[0]?.value?.toLocaleString()} <span className="text-[#99a1af] text-xs">{}</span>
        </p>
      </div>
    );
  }
  return null;
};

export function ListingPriceHistoryChart({
  data,
  currency = 'XLM',
}: ListingPriceHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-[#222] bg-[#111] text-[#99a1af] text-sm">
        No price history available.
      </div>
    );
  }

  const prices = data.map((d) => d.price);
  const minPrice = Math.min(...prices) * 0.98;
  const maxPrice = Math.max(...prices) * 1.02;

  return (
    <section aria-label="Listing price history">
      <h3 className="mb-3 text-sm font-semibold text-white">Price History</h3>
      <div className="rounded-xl border border-[#222] bg-[#111] p-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#51A2FF" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#51A2FF" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#555"
              tick={{ fill: '#8892a0', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              dy={6}
            />
            <YAxis
              stroke="#555"
              tick={{ fill: '#8892a0', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              domain={[minPrice, maxPrice]}
              tickFormatter={(v) => `${v.toLocaleString()}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#51A2FF"
              strokeWidth={2}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#51A2FF' }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <p className="mt-2 text-right text-xs text-[#99a1af]">Prices in {currency}</p>
      </div>
    </section>
  );
}
