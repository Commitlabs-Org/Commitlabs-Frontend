"use client";

import React from "react";
import { CommitmentDetailOverview } from "@/components/CommitmentDetailOverview";

export default function CommitmentOverviewPage() {
  return (
    <main className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-[1200px]">
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
