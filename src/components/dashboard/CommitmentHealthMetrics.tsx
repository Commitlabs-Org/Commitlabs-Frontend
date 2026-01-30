'use client';

import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HealthMetricsComplianceChart } from './HealthMetricsComplianceChart';

import { HealthMetricsValueHistoryChart } from './HealthMetricsValueHistoryChart';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type TabType = 'value' | 'drawdown' | 'fee' | 'compliance';

interface CommitmentHealthMetricsProps {
    complianceData: Array<{ date: string; complianceScore: number }>;
    valueHistoryData: Array<{ date: string; currentValue: number; initialAmount?: number }>;
}

export default function CommitmentHealthMetrics({
    complianceData,
    valueHistoryData,
}: CommitmentHealthMetricsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('compliance');

    const tabs: { id: TabType; label: string }[] = [
        { id: 'value', label: 'Value History' },
        { id: 'drawdown', label: 'Drawdown' },
        { id: 'fee', label: 'Fee Generation' },
        { id: 'compliance', label: 'Compliance' },
    ];

    return (
        <div className="w-full bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-semibold text-white">Health Metrics</h2>

                <div className="flex flex-wrap gap-2 p-1 bg-[#111] rounded-lg border border-[#222]">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                                activeTab === tab.id
                                    ? 'bg-[#222] text-[#4ADE80] shadow-sm'
                                    : 'text-[#666] hover:text-[#99a1af] hover:bg-[#1a1a1a]'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="w-full">
                {activeTab === 'compliance' && (
                    <HealthMetricsComplianceChart data={complianceData} />
                )}
                {activeTab === 'value' && (
                    <HealthMetricsValueHistoryChart data={valueHistoryData} />
                )}
                {activeTab !== 'compliance' && activeTab !== 'value' && (
                    <div className="flex items-center justify-center h-[300px] border border-[#222] border-dashed rounded-xl">
                        <p className="text-[#666]">
                            {tabs.find((t) => t.id === activeTab)?.label} chart placeholder
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
