"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from '@/lib/apiClient';
import { CommitmentDetailOverview } from "@/components/CommitmentDetailOverview";
import { AtRiskCommitments } from "@/components/dashboard/AtRiskCommitments";
import { Commitment } from "@/lib/types/domain";

export default function CommitmentOverviewPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);

  useEffect(() => {
    async function loadCommitments() {
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
      }
    }
    loadCommitments();
  }, []);

  return (
    <main id="main-content" className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-[1200px] flex flex-col gap-6">
        <div className="w-full">
          <AtRiskCommitments commitments={commitments} />
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
