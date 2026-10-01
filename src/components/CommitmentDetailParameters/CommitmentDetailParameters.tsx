'use client';

import React from 'react';

interface CommitmentDetailParametersProps {
  durationLabel: string;
  maxLossLabel: string;
  commitmentTypeLabel: string;
  earlyExitPenaltyLabel: string;
}

export function CommitmentDetailParameters({
  durationLabel,
  maxLossLabel,
  commitmentTypeLabel,
  earlyExitPenaltyLabel,
}: CommitmentDetailParametersProps) {
  return (
    <section aria-label="Commitment parameters">
      <h2 className="text-white text-xl font-bold mb-4">Parameters</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-white/50 text-sm">Type</span>
          <div className="text-white text-lg font-semibold">{commitmentTypeLabel}</div>
        </div>
        <div>
          <span className="text-white/50 text-sm">Duration</span>
          <div className="text-white text-lg font-semibold">{durationLabel}</div>
        </div>
        <div>
          <span className="text-white/50 text-sm">Max Loss</span>
          <div className="text-white text-lg font-semibold">{maxLossLabel}</div>
        </div>
        <div>
          <span className="text-white/50 text-sm">Early Exit Penalty</span>
          <div className="text-white text-lg font-semibold">{earlyExitPenaltyLabel}</div>
        </div>
      </div>
    </section>
  );
}
