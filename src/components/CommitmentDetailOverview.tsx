import React from "react";

export interface CommitmentDetailOverviewProps {
  commitmentTypeLabel: string;
  currentValue: string;
  currentValueAsset: string;
  gainLossLabel: string;
  gainLossVariant: "positive" | "negative" | "neutral";
  initialAmount: string;
  initialAmountAsset: string;
  createdDate: string;
  expiresDate: string;
  daysRemaining: number;
  durationPercentComplete: number;
  complianceScore: number;
  complianceScoreLabel?: string;
  maxLossThreshold: string;
  currentDrawdown: string;
  feesGenerated: string;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function scoreColor(score: number) {
  if (score >= 80) return "#22C55E";
  if (score >= 60) return "#F59E0B";
  return "#EF4444";
}

export function CommitmentDetailOverview({
  commitmentTypeLabel,
  currentValue,
  currentValueAsset,
  gainLossLabel,
  gainLossVariant,
  initialAmount,
  initialAmountAsset,
  createdDate,
  expiresDate,
  daysRemaining,
  durationPercentComplete,
  complianceScore,
  complianceScoreLabel = "Excellent compliance with commitment rules",
  maxLossThreshold,
  currentDrawdown,
  feesGenerated,
}: CommitmentDetailOverviewProps) {
  const percentComplete = clamp(durationPercentComplete);
  const compliance = clamp(complianceScore);
  const complianceFill = scoreColor(compliance);

  const gainLossStyles =
    gainLossVariant === "positive"
      ? "bg-[rgba(34,197,94,0.15)] text-[#22C55E] border-[rgba(34,197,94,0.35)]"
      : gainLossVariant === "negative"
      ? "bg-[rgba(239,68,68,0.15)] text-[#EF4444] border-[rgba(239,68,68,0.35)]"
      : "bg-[rgba(148,163,184,0.12)] text-[#CBD5F5] border-[rgba(148,163,184,0.35)]";

  return (
    <section
      aria-label="Commitment overview and compliance"
      className="w-full rounded-[24px] bg-[#0a0a0a] text-white/90"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="flex-1 rounded-[20px]  p-6 ">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#00C95055] bg-[#0f2a1d] px-3 py-1 text-[12px] font-semibold text-[#00C950] font-roboto">
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M16.6667 10.8333C16.6667 14.9454 13.8875 17.125 10.4167 18.3333C10.1208 18.4375 9.79583 18.4375 9.5 18.3333C6.02917 17.125 3.25 14.9454 3.25 10.8333V5.08333C3.25 4.6231 3.6231 4.25 4.08333 4.25C6.25 4.25 8.79167 2.91667 9.92917 1.825C9.97083 1.78542 10.0292 1.78542 10.0708 1.825C11.2083 2.91667 13.75 4.25 15.9167 4.25C16.3769 4.25 16.75 4.6231 16.75 5.08333L16.6667 10.8333Z"
                  stroke="#00C950"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {commitmentTypeLabel}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-[12px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
              Current Value
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-[32px] font-semibold text-white font-roboto">
                {currentValue}
              </span>
              <span className="text-[16px] text-white/60 font-roboto">
                {currentValueAsset}
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-semibold font-roboto ${gainLossStyles}`}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4.16675 13.3335L9.16675 8.3335L12.5001 11.6668L17.5001 6.66683"
                  stroke={
                    gainLossVariant === "negative" ? "#EF4444" : "#22C55E"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M13.3333 6.66683H17.5V10.8335"
                  stroke={
                    gainLossVariant === "negative" ? "#EF4444" : "#22C55E"
                  }
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {gainLossLabel}
            </span>
          </div>

          <div className="mt-6 space-y-3 text-[13px] text-white/70">
            <div>
              <span className="block text-white/50 font-['Inter',sans-serif]">
                Initial Amount
              </span>
              <span className="text-white/80 font-roboto">
                {initialAmount} {initialAmountAsset}
              </span>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="text-[12px] text-white/55 font-['Inter',sans-serif]">
              Duration Timeline
            </div>
            <div
              className="h-[8px] w-full rounded-full bg-white/10"
              role="progressbar"
              aria-label="Commitment duration progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentComplete}
            >
              <div
                className="h-full rounded-full bg-[linear-gradient(180deg,#0FF0FC_0%,#0A7A82_100%)]"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
            <div className="grid grid-cols-3 items-center text-[12px] text-white/50 font-['Inter', sans-serif]">
              <span className="justify-self-start whitespace-nowrap">
                Created
                <span className="block text-white/80 font-roboto">
                  {createdDate}
                </span>
              </span>
              <span className="justify-self-center text-center text-[#0FF0FC] whitespace-nowrap">
                {daysRemaining} days left
                <span className="block text-white/50 font-roboto">
                  {percentComplete}% complete
                </span>
              </span>
              <span className="justify-self-end text-right whitespace-nowrap">
                Expires
                <span className="block text-white/80 font-roboto">
                  {expiresDate}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-4 lg:w-[600px] lg:flex-none">
          <div className="rounded-[20px] border border-white/10 bg-[rgba(8,12,16,0.9)] p-6 shadow-[0_18px_45px_rgba(0,0,0,0.55),0_0_28px_rgba(15,240,252,0.12),inset_0_0_0_1px_rgba(255,255,255,0.04)]">
            <p className="text-[12px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
              Compliance Score
            </p>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-[60px] font-semibold text-[#0FF0FC] font-roboto">
                {compliance}
              </span>
              <span className="text-[30px] text-white/60 font-['Inter', sans-serif]">
                / 100
              </span>
            </div>
            <div
              className="mt-4 h-[8px] w-full rounded-full bg-white/10"
              role="progressbar"
              aria-label="Compliance score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={compliance}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${compliance}%`,
                  backgroundColor: complianceFill,
                }}
              />
            </div>
            <p className="mt-3 text-[12px] text-white/55 font-['Inter',sans-serif]">
              {complianceScoreLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-white/10 bg-[rgba(8,12,16,0.9)] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
                Days Remaining
              </p>
              <p className="mt-2 text-[16px] font-semibold text-white font-roboto">
                {daysRemaining}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[rgba(8,12,16,0.9)] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
                Max Loss Threshold
              </p>
              <p className="mt-2 text-[16px] font-semibold text-white font-roboto">
                {maxLossThreshold}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[rgba(8,12,16,0.9)] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
                Current Drawdown
              </p>
              <p className="mt-2 text-[16px] font-semibold text-white font-roboto">
                {currentDrawdown}
              </p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-[rgba(8,12,16,0.9)] p-4">
              <p className="text-[11px] uppercase tracking-[0.12em] text-white/50 font-['Inter',sans-serif]">
                Fees Generated
              </p>
              <p className="mt-2 text-[16px] font-semibold text-[#0FF0FC] font-roboto">
                {feesGenerated}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
