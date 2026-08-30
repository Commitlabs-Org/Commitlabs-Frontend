'use client';

import React from 'react';

interface CommitmentHealthMetricsProps {
  commitmentId: string;
  complianceData: Array<{ date: string; complianceScore: number }>;
  drawdownData: Array<{ date: string; drawdownPercent: number }>;
  valueHistoryData: Array<{
    date: string;
    currentValue: number;
    initialAmount: number;
  }>;
  feeGenerationData: Array<{ date: string; feeAmount: number }>;
  exposure: unknown;
}

/** Renders compliance, drawdown, value, and fee charts for a commitment. */
export default function CommitmentHealthMetrics({
  commitmentId,
  complianceData,
  drawdownData,
  valueHistoryData,
  feeGenerationData,
}: CommitmentHealthMetricsProps) {
  return (
    <section aria-label="Commitment health metrics" data-commitment-id={commitmentId}>
      <h2 className="text-white text-xl font-bold mb-4">Health Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]">
          <h3 className="text-white/70 text-sm font-medium mb-2">Compliance</h3>
          <div className="text-white text-2xl font-bold">
            {complianceData.length > 0
              ? `${complianceData[complianceData.length - 1].complianceScore}%`
              : '—'}
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]">
          <h3 className="text-white/70 text-sm font-medium mb-2">Drawdown</h3>
          <div className="text-white text-2xl font-bold">
            {drawdownData.length > 0
              ? `${drawdownData[drawdownData.length - 1].drawdownPercent}%`
              : '—'}
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]">
          <h3 className="text-white/70 text-sm font-medium mb-2">Value</h3>
          <div className="text-white text-2xl font-bold">
            {valueHistoryData.length > 0
              ? `$${valueHistoryData[valueHistoryData.length - 1].currentValue.toLocaleString()}`
              : '—'}
          </div>
        </div>
        <div className="bg-[#0a0a0a] rounded-xl p-4 border border-[#222]">
          <h3 className="text-white/70 text-sm font-medium mb-2">Fees Generated</h3>
          <div className="text-white text-2xl font-bold">
            {feeGenerationData.length > 0
              ? `$${feeGenerationData[feeGenerationData.length - 1].feeAmount}`
              : '—'}
          </div>
        </div>
      </div>
    </section>
  );
}
