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

import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';

interface HealthMetricsValueHistoryChartProps {
    data: Array<{ date: string; currentValue: number; initialAmount?: number }>;
    volatilityPercent?: number;
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
}) => {
    return (
        <>
            <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-sm">
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#333"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            dy={10}
                        />
                        <YAxis
                            stroke="#666"
                            tick={{ fill: '#666', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value.toLocaleString()}`}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            content={() => (
                                <div className="flex items-center justify-center gap-6 mt-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#0ff0fc]" />
                                        <span className="text-[#0ff0fc] text-sm">
                                            Current Value
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full border-2 border-[#666] border-dashed" />
                                        <span className="text-[#666] text-sm">
                                            Initial Amount
                                        </span>
                                    </div>
                                </div>
                            )}
                        />
                        {/* Initial Amount Line (Dashed) */}
                        <Line
                            type="monotone"
                            dataKey="initialAmount"
                            name="Initial Amount"
                            stroke="#666"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={false}
                            activeDot={false}
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
                        />
                    </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t border-[#222]">
                    <p className="text-[#99a1af] text-sm leading-relaxed text-center sm:text-left">
                        Track how your commitment value has changed over time compared to the initial amount.
                    </p>
                </div>
            </div>

            {volatilityPercent !== undefined && (
                <div className="mt-4">
                    <VolatilityExposureMeter
                        valuePercent={volatilityPercent}
                        description="Current exposure to volatile assets based on allocation and market conditions."
                    />
                </div>
            )}
        </>
    );
};
