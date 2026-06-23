'use client';

import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HealthMetricsComplianceChart } from './HealthMetricsComplianceChart';
import { HealthMetricsDrawdownChart } from './HealthMetricsDrawdownChart';
import { HealthMetricsValueHistoryChart } from './HealthMetricsValueHistoryChart';
import { HealthMetricsFeeGenerationChart } from './HealthMetricsFeeGenerationChart';
import { TrendingUp, TrendingDown, DollarSign, CheckCircle } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

type TabType = 'value' | 'drawdown' | 'fee' | 'compliance';

const tabs: { id: TabType; label: string }[] = [
    { id: 'value', label: 'Value History' },
    { id: 'drawdown', label: 'Drawdown' },
    { id: 'fee', label: 'Fee Generation' },
    { id: 'compliance', label: 'Compliance' },
];

const tabIcons: Record<TabType, React.ReactNode> = {
    value: <TrendingUp className="w-4 h-4" />,
    drawdown: <TrendingDown className="w-4 h-4" />,
    fee: <DollarSign className="w-4 h-4" />,
    compliance: <CheckCircle className="w-4 h-4" />,
};

interface CommitmentHealthMetricsProps {
    complianceData: Array<{ date: string; complianceScore: number }>;
    drawdownData: Array<{ date: string; drawdownPercent: number }>;
    valueHistoryData: Array<{ date: string; currentValue: number; initialAmount?: number }>;
    feeGenerationData: Array<{ date: string; feeAmount: number }>;
    thresholdPercent?: number;
    volatilityPercent?: number;
}

export default function CommitmentHealthMetrics({
    complianceData,
    drawdownData,
    valueHistoryData,
    feeGenerationData,
    thresholdPercent,
    volatilityPercent,
}: CommitmentHealthMetricsProps) {
    const [activeTab, setActiveTab] = useState<TabType>('value');

    const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
        const lastIndex = tabs.length - 1;
        let nextIndex: number | null = null;

        if (event.key === 'ArrowRight') {
            nextIndex = index === lastIndex ? 0 : index + 1;
        } else if (event.key === 'ArrowLeft') {
            nextIndex = index === 0 ? lastIndex : index - 1;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = lastIndex;
        }

        if (nextIndex !== null) {
            event.preventDefault();
            setActiveTab(tabs[nextIndex].id);
            event.currentTarget
                .closest('[role="tablist"]')
                ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                [nextIndex]?.focus();
        }
    };

    return (
        <div className="w-full bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <h2 className="text-2xl font-semibold text-white">Health Metrics</h2>

                <div
                    className="flex flex-wrap gap-2 p-1 bg-[#111] rounded-lg border border-[#222]"
                    role="tablist"
                    aria-label="Health metric charts"
                >
                    {tabs.map((tab, index) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            onKeyDown={(event) => handleTabKeyDown(event, index)}
                            role="tab"
                            id={`health-metric-tab-${tab.id}`}
                            aria-selected={activeTab === tab.id}
                            aria-controls={`health-metric-panel-${tab.id}`}
                            tabIndex={activeTab === tab.id ? 0 : -1}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
                                activeTab === tab.id
                                    ? 'bg-[#222] text-[#0ff0fc] shadow-sm'
                                    : 'text-[#666] hover:text-[#99a1af] hover:bg-[#1a1a1a]'
                            )}
                        >
                            {tabIcons[tab.id]}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div
                className="w-full"
                role="tabpanel"
                id={`health-metric-panel-${activeTab}`}
                aria-labelledby={`health-metric-tab-${activeTab}`}
            >
                {activeTab === 'value' && (
                    <HealthMetricsValueHistoryChart 
                        data={valueHistoryData} 
                        volatilityPercent={volatilityPercent}
                    />
                )}
                {activeTab === 'drawdown' && (
                    <HealthMetricsDrawdownChart 
                        data={drawdownData}
                        thresholdPercent={thresholdPercent}
                        volatilityPercent={volatilityPercent}
                    />
                )}
                {activeTab === 'fee' && (
                    <HealthMetricsFeeGenerationChart 
                        data={feeGenerationData}
                        volatilityPercent={volatilityPercent}
                    />
                )}
                {activeTab === 'compliance' && (
                    <HealthMetricsComplianceChart data={complianceData} />
                )}
            </div>
        </div>
    );
}
