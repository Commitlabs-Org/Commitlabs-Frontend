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

interface HealthMetricsComplianceChartProps {
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
        return (
            <div className="bg-[#1a1a1a] border border-[#333] p-3 rounded-lg shadow-lg">
                <p className="text-[#99a1af] text-sm mb-1">{label}</p>
                <p className="text-[#4ADE80] text-sm font-medium">
                    Score: {payload[0].value}
                </p>
            </div>
        );
    }
    return null;
};

export const HealthMetricsComplianceChart: React.FC<HealthMetricsComplianceChartProps> = ({
    data,
}) => {
    return (
        <div className="w-full h-full min-h-[300px] bg-[#111] rounded-xl p-4 sm:p-6 border border-[#222]">
            <ResponsiveContainer width="100%" height={300}>
                <LineChart
                    data={data}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
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
                        domain={[0, 100]}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#333' }} />
                    <Legend
                        verticalAlign="bottom"
                        height={36}
                        content={() => (
                            <div className="flex items-center justify-center gap-2 mt-4">
                                <div className="w-3 h-3 rounded-full bg-[#4ADE80]" />
                                <span className="text-[#99a1af] text-sm">
                                    Compliance Score
                                </span>
                            </div>
                        )}
                    />
                    <Line
                        type="monotone"
                        dataKey="complianceScore"
                        stroke="#4ADE80"
                        strokeWidth={2}
                        dot={{ r: 4, fill: '#4ADE80', stroke: '#111', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#4ADE80' }}
                    />
                </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-[#222]">
                <p className="text-[#99a1af] text-sm leading-relaxed">
                    Historical compliance score showing how well the commitment has
                    adhered to its rules.
                </p>
            </div>
        </div>
    );
};
