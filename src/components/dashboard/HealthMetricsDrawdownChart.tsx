'use client';

import React from 'react';
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
import type { CommitmentExposureResult } from '@/utils/exposure';

export interface LifecycleEvent {
    /** Date string matching a point in the chart data (e.g. "2024-01"). */
    date: string;
    /** Short label shown on the annotation line (e.g. "Inception", "Rebalance"). */
    label: string;
    /** Optional colour override. Defaults to amber (#F59E0B). */
    color?: string;
}

interface HealthMetricsDrawdownChartProps {
    data: Array<{ date: string; drawdownPercent: number }>;
    thresholdPercent?: number;
    volatilityPercent?: number;
    /** Vertical annotation lines for lifecycle events (inception, rebalances, etc.). */
    lifecycleEvents?: LifecycleEvent[];
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

export const HealthMetricsDrawdownChart: React.FC<HealthMetricsDrawdownChartProps> = ({
    data,
    thresholdPercent,
    volatilityPercent,
    lifecycleEvents = [],
}) => {
    return (
        <>
            <div className="w-full h-full min-h-[300px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222]">
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#DC2626" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#DC2626" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#333"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            stroke="#8892a0"
                            tick={{ fill: '#8892a0', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#8892a0"
                            tick={{ fill: '#8892a0', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 1]}
                            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            content={() => (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <div className="w-3 h-3 rounded-full bg-[#DC2626]" />
                                    <span className="text-[#99a1af] text-sm">
                                        Drawdown %
                                    </span>
                                </div>
                            )}
                        />
                        {thresholdPercent !== undefined && (
                            <ReferenceLine
                                y={thresholdPercent}
                                stroke="#DC2626"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                opacity={0.6}
                            />
                        )}
                        {lifecycleEvents.map((ev) => (
                            <ReferenceLine
                                key={ev.date}
                                x={ev.date}
                                stroke={ev.color ?? '#F59E0B'}
                                strokeWidth={1.5}
                                strokeDasharray="4 3"
                                label={{
                                    value: ev.label,
                                    position: 'top',
                                    fill: ev.color ?? '#F59E0B',
                                    fontSize: 10,
                                }}
                            />
                        ))}
                        <Area
                            type="monotone"
                            dataKey="drawdownPercent"
                            stroke="#DC2626"
                            strokeWidth={2}
                            fill="url(#drawdownGradient)"
                            dot={{ r: 4, fill: '#DC2626', stroke: '#111', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#DC2626' }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t border-[#222]">
                    <p className="text-[#99a1af] text-sm leading-relaxed">
                        Monitor the maximum loss from peak value. Red line shows current drawdown, dashed line is your threshold.
                    </p>
                </div>
            </div>
            
            {exposure && (
                <div className="mt-4">
                    <VolatilityExposureMeter
                        insufficientData={exposure.status === 'insufficient_data'}
                        valuePercent={exposure.exposurePercent}
                        zoneThresholds={exposure.zoneThresholds}
                        description="Current exposure to volatile assets based on allocation and market conditions."
                    />
                </div>
            )}
        </>
    );
};
