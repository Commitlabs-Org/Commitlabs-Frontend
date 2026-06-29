'use client';

import React from 'react';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import { EmptyState } from '@/components/ui/EmptyState';

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
  return (
    <div className="flex flex-col gap-4">
      <div className="text-[14px] text-[#94A3B8]">
        <span className="text-[16px] font-semibold text-white">{commitments.length}</span>{' '}
        commitments found
      </div>
      
      {commitments.length > 0 ? (
        <div className="grid grid-cols-3 gap-6 max-[1200px]:grid-cols-2 max-[768px]:grid-cols-1">
          {commitments.map((commitment) => (
            <MyCommitmentCard
              key={commitment.id}
              commitment={commitment}
              onDetails={onDetails}
              onAttestations={onAttestations}
              onEarlyExit={onEarlyExit}
              onListForSale={onListForSale}
            />
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
  );
};

export default MyCommitmentsGrid;
