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
    ReferenceLine,
} from 'recharts';
import type { LifecycleEvent } from './HealthMetricsDrawdownChart';

import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';
import { useReducedMotion } from '@/lib/a11y/useReducedMotion';

interface HealthMetricsValueHistoryChartProps {
    data: Array<{ date: string; currentValue: number; initialAmount?: number }>;
    volatilityPercent?: number;
    /** Vertical annotation lines for lifecycle events. */
    lifecycleEvents?: LifecycleEvent[];
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
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: entry.color }}
                        />
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

export const HealthMetricsValueHistoryChart: React.FC<HealthMetricsValueHistoryChartProps> = ({
    data,
    volatilityPercent,
    lifecycleEvents = [],
}) => {
    const reducedMotion = useReducedMotion();

    // Merge benchmark values by date so Recharts can render them on the same chart.
    const hasBenchmark = benchmarkData && benchmarkData.length > 0;
    const benchmarkByDate = React.useMemo(() => {
        if (!hasBenchmark) return {};
        return Object.fromEntries(benchmarkData!.map((p) => [p.date, p.benchmarkValue]));
    }, [benchmarkData, hasBenchmark]);

    const mergedData = React.useMemo(() => {
        if (!hasBenchmark) return data;
        return data.map((point) => ({
            ...point,
            benchmarkValue: benchmarkByDate[point.date] ?? null,
        }));
    }, [data, hasBenchmark, benchmarkByDate]);

    return (
        <>
            <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-sm">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={mergedData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
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
                            tickFormatter={(value) => `${value.toLocaleString()}`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            content={() => (
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
                            )}
                        />
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
                        {/* Initial Amount Line (Dashed) */}
                        <Line
                            type="monotone"
                            dataKey="initialAmount"
                            name="Initial Amount"
                            stroke="#8892a0"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={false}
                            isAnimationActive={!reducedMotion}
                        />
                        {/* Current Value Line (Teal) */}
                        <Line
                            type="monotone"
                            dataKey="currentValue"
                            name="Current Value"
                            stroke="#0ff0fc"
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#0ff0fc', stroke: '#111', strokeWidth: 2 }}
                            activeDot={{ r: 6, fill: '#0ff0fc', stroke: '#111', strokeWidth: 2 }}
                            isAnimationActive={!reducedMotion}
                        />
                        {/* Benchmark overlay line — only rendered when data is provided */}
                        {hasBenchmark && (
                            <Line
                                type="monotone"
                                dataKey="benchmarkValue"
                                name={benchmarkLabel}
                                stroke="#f5a623"
                                strokeWidth={2}
                                strokeDasharray="4 2"
                                dot={false}
                                activeDot={{ r: 5, fill: '#f5a623', stroke: '#111', strokeWidth: 2 }}
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
