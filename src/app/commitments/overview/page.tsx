"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { apiGet } from '@/lib/apiClient';
import { CommitmentDetailOverview } from "@/components/CommitmentDetailOverview";
import { AtRiskCommitments } from "@/components/dashboard/AtRiskCommitments";
import { RecentActivityFeed } from "@/components/dashboard/RecentActivityFeed";
import { Commitment } from "@/lib/types/domain";
import OverviewTimeRangeSelector from "@/components/overview/OverviewTimeRangeSelector";
import { useOverviewTimeRange } from "@/hooks/useOverviewTimeRange";

const PortfolioAllocationChart = dynamic(
  () =>
    import(
      "@/components/dashboard/PortfolioAllocationChart"
    ).then((mod) => mod.PortfolioAllocationChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="bg-[#111] border border-[#222] rounded-xl p-6 h-80 animate-pulse" />
    ),
  },
);

export default function CommitmentOverviewPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);

  const { selectedRange, setRange, filterByRange } = useOverviewTimeRange();

  useEffect(() => {
    if (!atRiskVisible) return;
    async function loadCommitments() {
      setLoading(true);
      try {
        const data = await apiGet<{ data: Commitment[] }>('/api/commitments');
        setCommitments(data.data);
          if (data && Array.isArray(data.data)) {
            setCommitments(data.data);
          } else if (Array.isArray(data)) {
            setCommitments(data);
          }
      } catch (err) {
        console.error("Failed to load commitments", err);
      } finally {
        setLoading(false);
      }
    }
    loadCommitments();
  }, [atRiskVisible]);

  const renderWidget = (id: string) => {
    switch (id) {
      case "at-risk":
        return <AtRiskCommitments commitments={commitments} />;
      case "commitment-detail":
        return (
          <CommitmentDetailOverview
            commitmentTypeLabel="Safe Commitment"
            currentValue="52,600"
            currentValueAsset="XLM"
            gainLossLabel="+5.20% (+2,600 XLM)"
            gainLossVariant="positive"
            initialAmount="50,000"
            initialAmountAsset="XLM"
            createdDate="Jan 10, 2026"
            expiresDate="Feb 9, 2026"
            daysRemaining={12}
            durationPercentComplete={87}
            complianceScore={95}
            complianceScoreLabel="Excellent compliance with commitment rules"
            maxLossThreshold="2%"
            currentDrawdown="0.8%"
            feesGenerated="$126"
          />
        );
      default:
        return null;
    }
  };

  const filteredCommitments = filterByRange(
    commitments,
    (c) => (c as Commitment & { createdAt?: string }).createdAt ?? new Date(0).toISOString()
  );

  return (
    <main id="main-content" className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-[1200px] flex flex-col gap-6">
        {/* Page header with time-range filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold text-white">Commitments Overview</h1>
          <OverviewTimeRangeSelector
            selected={selectedRange}
            onChange={setRange}
            aria-label="Filter overview by time range"
          />
        </div>
        <div className="w-full">
          <PortfolioAllocationChart commitments={commitments} />
        </div>
        <div className="w-full">
          <RecentActivityFeed commitments={commitments} />
        </div>
        <CommitmentDetailOverview
          commitmentTypeLabel="Safe Commitment"
          currentValue="52,600"
          currentValueAsset="XLM"
          gainLossLabel="+5.20% (+2,600 XLM)"
          gainLossVariant="positive"
          initialAmount="50,000"
          initialAmountAsset="XLM"
          createdDate="Jan 10, 2026"
          expiresDate="Feb 9, 2026"
          daysRemaining={12}
          durationPercentComplete={87}
          complianceScore={95}
          complianceScoreLabel="Excellent compliance with commitment rules"
          maxLossThreshold="2%"
          currentDrawdown="0.8%"
          feesGenerated="$126"
        />
      </div>
    </main>
  );
}
