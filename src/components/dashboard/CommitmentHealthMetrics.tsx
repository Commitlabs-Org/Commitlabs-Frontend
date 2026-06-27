'use client';

import React, { useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dynamic from 'next/dynamic';
import { TrendingUp, TrendingDown, DollarSign, CheckCircle } from 'lucide-react';
import HealthMetricsSkeleton from '../HealthMetricsSkeleton';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const HealthMetricsValueHistoryChart = dynamic(
    () => import('./HealthMetricsValueHistoryChart').then((mod) => mod.HealthMetricsValueHistoryChart),
    { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsDrawdownChart = dynamic(
    () => import('./HealthMetricsDrawdownChart').then((mod) => mod.HealthMetricsDrawdownChart),
    { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsFeeGenerationChart = dynamic(
    () => import('./HealthMetricsFeeGenerationChart').then((mod) => mod.HealthMetricsFeeGenerationChart),
    { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

const HealthMetricsComplianceChart = dynamic(
    () => import('./HealthMetricsComplianceChart').then((mod) => mod.HealthMetricsComplianceChart),
    { ssr: false, loading: () => <HealthMetricsSkeleton /> }
);

type TabType = 'value' | 'drawdown' | 'fee' | 'compliance';

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

            <div className="w-full">
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
