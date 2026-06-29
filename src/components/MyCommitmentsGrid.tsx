'use client';

import React, { useState } from 'react';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import { EmptyState } from '@/components/ui/EmptyState';
import { CompareCommitmentsTray } from './CompareCommitmentsTray';

interface MyCommitmentsGridProps {
  commitments: Commitment[];
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
  onListForSale?: (id: string) => void;
}

const MyCommitmentsGrid: React.FC<MyCommitmentsGridProps> = ({
  commitments,
  onDetails,
  onAttestations,
  onEarlyExit,
  onListForSale,
}) => {
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < CompareCommitmentsTray.MAX) {
        next.add(id);
      }
      return next;
    });
  };

  const selectedCommitments = commitments.filter((c) => compareIds.has(c.id));

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="text-[14px] text-[#94A3B8]">
          <span className="text-[16px] font-semibold text-white">{commitments.length}</span>{' '}
          commitments found
        </div>

        {commitments.length > 0 ? (
          <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
            {commitments.map((commitment) => (
              <div key={commitment.id} className="relative">
                <MyCommitmentCard
                  commitment={commitment}
                  onDetails={onDetails}
                  onAttestations={onAttestations}
                  onEarlyExit={onEarlyExit}
                  onListForSale={onListForSale}
                />
                <button
                  type="button"
                  onClick={() => toggleCompare(commitment.id)}
                  aria-pressed={compareIds.has(commitment.id)}
                  aria-label={`${compareIds.has(commitment.id) ? 'Remove from' : 'Add to'} compare`}
                  className={`absolute top-3 left-3 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-[#51A2FF] ${
                    compareIds.has(commitment.id)
                      ? 'border-[#51A2FF] bg-[#51A2FF]/20 text-[#51A2FF]'
                      : 'border-[#333] bg-[#1a1a1a] text-[#99a1af] hover:border-[#51A2FF]/50 hover:text-white'
                  }`}
                >
                  {compareIds.has(commitment.id) ? '✓ Comparing' : '+ Compare'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No commitments found"
            description="No commitments found matching your filters."
            cta={{ label: 'Create your first commitment', href: '/create' }}
          />
        )}
      </div>

      <CompareCommitmentsTray
        selected={selectedCommitments}
        onRemove={(id) => toggleCompare(id)}
        onClear={() => setCompareIds(new Set())}
      />
    </>
  );
};

export default MyCommitmentsGrid;
