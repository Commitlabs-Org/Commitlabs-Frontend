'use client';

import React from 'react';
import { Star, ShieldCheck, History } from 'lucide-react';

interface ReputationDisplayProps {
  score: number; // 0-100
  totalCommitments: number;
  successRate: number; // percentage
  className?: string;
}

export const ReputationDisplay: React.FC<ReputationDisplayProps> = ({
  score,
  totalCommitments,
  successRate,
  className = ''
}) => {
  const getScoreColor = (s: number) => {
    if (s >= 90) return 'text-[#00C950]';
    if (s >= 75) return 'text-[#51A2FF]';
    return 'text-[#FF8904]';
  };

  return (
    <div className={`flex flex-col gap-3 p-4 rounded-xl bg-white/5 border border-white/10 ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Seller Reputation</span>
        <div className="flex items-center gap-1">
          <Star className={`w-3.5 h-3.5 fill-current ${getScoreColor(score)}`} />
          <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}/100</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <History className="w-3 h-3" />
            Track Record
          </div>
          <div className="text-[13px] font-semibold text-white/90">
            {totalCommitments} <span className="text-[10px] font-medium text-white/40">Total</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] text-white/50">
            <ShieldCheck className="w-3 h-3" />
            Reliability
          </div>
          <div className="text-[13px] font-semibold text-white/90">
            {successRate}% <span className="text-[10px] font-medium text-white/40">Success</span>
          </div>
        </div>
      </div>

      <div className="pt-2 mt-1 border-t border-white/5">
        <p className="text-[9px] leading-relaxed text-white/30 italic">
          Reputation is calculated based on successful commitment completions, timely attestations, and tenure on the platform.
        </p>
      </div>
    </div>
  );
};
