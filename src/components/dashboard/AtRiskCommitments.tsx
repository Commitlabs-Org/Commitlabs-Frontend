import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Commitment } from '@/lib/types/domain';
import { AtRiskCommitment, classifyAtRiskCommitments } from '@/utils/classification';
import { ProtocolConstants, fetchProtocolConstants } from '@/utils/protocol';

interface AtRiskCommitmentsProps {
  commitments?: Commitment[];
}

export function AtRiskCommitments({ commitments = [] }: AtRiskCommitmentsProps) {
  const [atRisk, setAtRisk] = useState<AtRiskCommitment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const constants = await fetchProtocolConstants();
        setAtRisk(classifyAtRiskCommitments(commitments, constants));
      } catch (err) {
        // Fallback without constants
        setAtRisk(classifyAtRiskCommitments(commitments, null));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [commitments]);

  if (loading) {
    return <div className="animate-pulse h-24 bg-zinc-900 rounded-xl" />;
  }

  if (atRisk.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <h3 className="text-lg font-medium text-white mb-2">All Commitments Healthy</h3>
        <p className="text-zinc-400 text-sm">
          No commitments currently need your attention.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-red-900/50 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800 bg-red-950/20 flex items-center justify-between">
        <h3 className="text-lg font-medium text-red-400 flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
          Needs Attention
        </h3>
        <span className="text-xs font-semibold bg-red-500/20 text-red-400 px-2.5 py-1 rounded-full">
          {atRisk.length} at risk
        </span>
      </div>
      
      <ul className="divide-y divide-zinc-800/50" role="list" aria-label="At-risk commitments">
        {atRisk.map((commitment) => (
          <li key={commitment.id} className="p-4 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/commitments/${commitment.id}`} className="text-white font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-red-500 rounded">
                  Commitment {commitment.id.substring(0, 8)}
                </Link>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {commitment.riskCategories.map((category) => (
                    <span 
                      key={category} 
                      className="inline-block text-zinc-400 capitalize bg-zinc-800 px-2 py-0.5 rounded"
                    >
                      {category.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
              <Link 
                href={`/commitments/${commitment.id}`}
                className="text-sm bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Review
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
