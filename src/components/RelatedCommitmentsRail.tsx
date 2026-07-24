'use client';

import React from 'react';
import Link from 'next/link';

export interface RelatedCommitment {
  id: string;
  type: string;
  complianceScore: number;
  duration: string;
  status: 'active' | 'expired' | 'pending';
}

interface RelatedCommitmentsRailProps {
  commitments: RelatedCommitment[];
  currentId: string;
}

const STATUS_COLORS: Record<RelatedCommitment['status'], string> = {
  active: 'text-green-400',
  expired: 'text-[#99a1af]',
  pending: 'text-amber-400',
};

const TYPE_COLORS: Record<string, string> = {
  Balanced: 'text-[#51A2FF]',
  Aggressive: 'text-[#FF8904]',
  Safe: 'text-green-400',
};

export function RelatedCommitmentsRail({
  commitments,
  currentId,
}: RelatedCommitmentsRailProps) {
  const related = commitments.filter((c) => c.id !== currentId);

  if (related.length === 0) return null;

  return (
    <aside aria-label="Related commitments">
      <h2 className="text-white text-lg font-semibold mb-4">Related Commitments</h2>
      <ul className="flex flex-col gap-3" role="list">
        {related.map((c) => (
          <li key={c.id}>
            <Link
              href={`/commitments/${c.id}`}
              className="flex items-center justify-between rounded-xl bg-[#111] border border-[#222] p-4 hover:border-[#333] transition-colors focus:outline-none focus:ring-1 focus:ring-[#51A2FF]"
              aria-label={`Commitment #${c.id} — ${c.type}, ${c.status}`}
            >
              <div>
                <p className="text-white text-sm font-medium">
                  #{c.id.padStart(3, '0')} &nbsp;
                  <span className={TYPE_COLORS[c.type] ?? 'text-white/70'}>
                    {c.type}
                  </span>
                </p>
                <p className="text-[#99a1af] text-xs mt-0.5">{c.duration}</p>
              </div>
              <div className="text-right">
                <p className="text-white text-sm font-medium">{c.complianceScore}%</p>
                <p className={`text-xs capitalize mt-0.5 ${STATUS_COLORS[c.status]}`}>
                  {c.status}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
