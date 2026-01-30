'use client';

import React from 'react';
import styles from './MyCommitmentsGrid.module.css';
import MyCommitmentCard from './MyCommitmentCard';
import { Commitment } from '@/types/commitment';
import Link from 'next/link';

interface MyCommitmentsGridProps {
  commitments: Commitment[];
  onDetails?: (id: string) => void;
  onAttestations?: (id: string) => void;
  onEarlyExit?: (id: string) => void;
}

const MyCommitmentsGrid: React.FC<MyCommitmentsGridProps> = ({
  commitments,
  onDetails,
  onAttestations,
  onEarlyExit,
}) => {
  return (
    <div className={styles.gridWrapper}>
      <div className={styles.countLabel}>
       <span className={styles.countNum}>{commitments.length}</span> commitments found
      </div>
      
      {commitments.length > 0 ? (
        <div className={styles.grid}>
          {commitments.map((commitment) => (
            <MyCommitmentCard 
              key={commitment.id} 
              commitment={commitment}
              onDetails={onDetails}
              onAttestations={onAttestations}
              onEarlyExit={onEarlyExit}
            />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No commitments found matching your filters.</p>
          <Link href="/create" className={styles.createLink}>
            Create your first commitment
          </Link>
        </div>
      )}
    </div>
  );
};

export default MyCommitmentsGrid;
