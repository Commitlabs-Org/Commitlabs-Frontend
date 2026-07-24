"use client";

import React, { useEffect, useState } from "react";
import { CommitmentDetailOverview } from "@/components/CommitmentDetailOverview";
import { Commitment } from "@/types/commitment";
import { listCommitments } from "@/lib/backend/mocks/contracts";

export default function CommitmentOverviewPage() {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [atRiskVisible, setAtRiskVisible] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    listCommitments()
      .then((data) => {
        setCommitments(data);
      })
      .catch(() => {
        setError("Failed to load commitments. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const displayed = atRiskVisible
    ? commitments.filter((c) => c.complianceScore < 80)
    : commitments;

  if (isLoading) {
    return (
      <main className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-[1200px]">
          <p className="text-white/60">Loading commitments…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
        <div className="mx-auto w-full max-w-[1200px]">
          <p className="text-red-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-[#0a0a0a] px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAtRiskVisible((prev) => !prev)}
            aria-pressed={atRiskVisible}
            className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10 transition-colors"
          >
            {atRiskVisible ? "Show All" : "Show At-Risk Only"}
          </button>
        </div>

        {displayed.length === 0 ? (
          <p className="text-white/60">
            {atRiskVisible
              ? "No at-risk commitments found."
              : "No commitments found."}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {displayed.map((commitment) => (
              <CommitmentDetailOverview
                key={commitment.id}
                commitmentTypeLabel={`${commitment.type} Commitment`}
                currentValue={commitment.currentValue}
                currentValueAsset={commitment.asset}
                gainLossLabel={
                  commitment.changePercent >= 0
                    ? `+${commitment.changePercent}%`
                    : `${commitment.changePercent}%`
                }
                gainLossVariant={
                  commitment.changePercent > 0
                    ? "positive"
                    : commitment.changePercent < 0
                    ? "negative"
                    : "neutral"
                }
                initialAmount={commitment.amount}
                initialAmountAsset={commitment.asset}
                createdDate={commitment.createdDate}
                expiresDate={commitment.expiryDate}
                daysRemaining={commitment.daysRemaining}
                durationPercentComplete={commitment.durationProgress}
                complianceScore={commitment.complianceScore}
                maxLossThreshold={commitment.maxLoss}
                currentDrawdown={commitment.currentDrawdown}
                feesGenerated="—"
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
