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

import VolatilityExposureMeter from '../VolatilityExposureMeter/VolatilityExposureMeter';

interface HealthMetricsFeeGenerationChartProps {
    data: Array<{ date: string; feeAmount: number }>;
    volatilityPercent?: number;
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
        return (
            <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg">
                <p className="text-[#99a1af] text-sm mb-1">{label}</p>
                <p className="text-[#0ff0fc] text-sm font-medium">
                    Fees: ${payload[0].value.toLocaleString()}
                </p>
            </div>
        );
    }
    return null;
};

export const HealthMetricsFeeGenerationChart: React.FC<HealthMetricsFeeGenerationChartProps> = ({
    data,
    volatilityPercent,
}) => {
    return (
        <>
            <div className="w-full h-full min-h-[350px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222] shadow-[inset_0_1px_1px_rgba(255,255,255,0.03)]">
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                        data={data}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                        barCategoryGap="20%"
                    >
                        <defs>
                            <linearGradient id="feeBarGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#0ff0fc" stopOpacity={1} />
                                <stop offset="100%" stopColor="#0ff0fc" stopOpacity={0.7} />
                            </linearGradient>
                            <filter id="feeBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                                <feGaussianBlur stdDeviation="3" result="blur" />
                                <feComposite in="SourceGraphic" in2="blur" operator="over" />
                            </filter>
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
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip 
                            content={<CustomTooltip />} 
                            cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} 
                        />
                        <Legend
                            verticalAlign="bottom"
                            height={36}
                            content={() => (
                                <div className="flex items-center justify-center gap-2 mt-4">
                                    <div className="w-3 h-3 rounded-sm bg-[#0ff0fc]" />
                                    <span className="text-[#0ff0fc] text-sm">
                                        Fees ($)
                                    </span>
                                </div>
                            )}
                        />
                        <Bar
                            dataKey="feeAmount"
                            fill="url(#feeBarGradient)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={60}
                        >
                            {data.map((_, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    filter="url(#feeBarGlow)"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-4 border-t border-[#222]">
                    <p className="text-[#99a1af] text-sm leading-relaxed text-center sm:text-left">
                        View fees generated over the commitment period from yield and protocol incentives.
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
