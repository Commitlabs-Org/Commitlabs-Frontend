'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useMemo } from 'react';
import MyCommitmentsHeader from '@/components/MyCommitmentsHeader';
import MyCommitmentsStats from '@/components/MyCommitmentsStats';
import MyCommitmentsFilters from '@/components/MyCommitmentsFilters';
import MyCommitmentsGrid from '@/components/MyCommitmentsGrid';
import CommitmentEarlyExitModal from '@/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal';
import styles from './page.module.css';
import { Commitment, CommitmentStats } from '@/types/commitment';

const mockCommitments: Commitment[] = [
  {
    id: 'CMT-ABC123',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    currentValue: '52,600',
    changePercent: 5.20,
    durationProgress: 75,
    daysRemaining: 15,
    complianceScore: 95,
    maxLoss: '2%',
    currentDrawdown: '0.8%',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026',
  },
  {
    id: 'CMT-XYZ789',
    type: 'Balanced',
    status: 'Active',
    asset: 'USDC',
    amount: '100,000',
    currentValue: '112,500',
    changePercent: 12.50,
    durationProgress: 30,
    daysRemaining: 42,
    complianceScore: 88,
    maxLoss: '8%',
    currentDrawdown: '3.2%',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026',
  },
  {
    id: 'CMT-DEF456',
    type: 'Aggressive',
    status: 'Active',
    asset: 'XLM',
    amount: '250,000',
    currentValue: '296,750',
    changePercent: 18.70,
    durationProgress: 17,
    daysRemaining: 75,
    complianceScore: 76,
    maxLoss: 'No limit',
    currentDrawdown: '12.5%',
    createdDate: 'Nov 20, 2025',
    expiryDate: 'Feb 10, 2026',
  },
  {
    id: 'CMT-GHI012',
    type: 'Safe',
    status: 'Settled',
    asset: 'XLM',
    amount: '75,000',
    currentValue: '78,750',
    changePercent: 5.00,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 97,
    maxLoss: '2%',
    currentDrawdown: '0%',
    createdDate: 'Dec 1, 2025',
    expiryDate: 'Dec 31, 2025',
  },
  {
    id: 'CMT-JKL345',
    type: 'Balanced',
    status: 'Early Exit',
    asset: 'USDC',
    amount: '150,000',
    currentValue: '145,500',
    changePercent: -3.00,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 72,
    maxLoss: '8%',
    currentDrawdown: '3%',
    createdDate: 'Nov 1, 2025',
    expiryDate: 'Dec 30, 2025',
  },
  {
    id: 'CMT-MN0678',
    type: 'Aggressive',
    status: 'Violated',
    asset: 'XLM',
    amount: '200,000',
    currentValue: '160,000',
    changePercent: -20.00,
    durationProgress: 100,
    daysRemaining: 0,
    complianceScore: 45,
    maxLoss: 'No limit',
    currentDrawdown: '20%',
    createdDate: 'Oct 15, 2025',
    expiryDate: 'Jan 13, 2026',
  },
];

const mockStats: CommitmentStats = {
  totalActive: 3,
  totalCommittedValue: '$461,850',
  avgComplianceScore: 86,
  totalFeesGenerated: '$1,250',
};

// Mock early-exit penalty logic
function getEarlyExitValues(originalAmount: string, asset: string) {
  const amount = Number(originalAmount.replace(/,/g, ''));
  const penaltyPercent = 10;
  const penaltyAmount = (amount * (penaltyPercent / 100)).toFixed(0);
  const netReceive = (amount - Number(penaltyAmount)).toFixed(0);
  return {
    penaltyPercent: `${penaltyPercent}%`,
    penaltyAmount: `${Number(penaltyAmount).toLocaleString()} ${asset}`,
    netReceiveAmount: `${Number(netReceive).toLocaleString()} ${asset}`,
  };
}

export default function MyCommitments() {
  const router = useRouter();
  
  // State for filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');

  // State for Early Exit Modal
  const [earlyExitCommitmentId, setEarlyExitCommitmentId] = useState<string | null>(null);
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Derived filtered commitments
  const filteredCommitments = useMemo(() => {
    return mockCommitments.filter((c) => {
      const matchesSearch = c.id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchesType = typeFilter === 'All' || c.type === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [searchQuery, statusFilter, typeFilter]);

  const commitmentForEarlyExit = mockCommitments.find((c) => c.id === earlyExitCommitmentId);
  const earlyExitSummary = useMemo(() => {
    return commitmentForEarlyExit
      ? getEarlyExitValues(commitmentForEarlyExit.amount, commitmentForEarlyExit.asset)
      : null;
  }, [commitmentForEarlyExit]);

  const openEarlyExitModal = useCallback((id: string) => {
    setEarlyExitCommitmentId(id);
    setHasAcknowledged(false);
  }, []);

  const closeEarlyExitModal = useCallback(() => {
    setEarlyExitCommitmentId(null);
    setHasAcknowledged(false);
  }, []);

  const handleConfirmEarlyExit = useCallback(() => {
    if (!earlyExitCommitmentId) return;
    // Perform transaction logic here
    closeEarlyExitModal();
  }, [earlyExitCommitmentId, closeEarlyExitModal]);

  return (
    <main id="main-content" className={styles.pageWrapper}>
      <MyCommitmentsHeader 
        onBack={() => router.push('/')}
        onCreateNew={() => router.push('/create')}
      />

      <div className={styles.container}>
        <MyCommitmentsStats stats={mockStats} />
        
        <MyCommitmentsFilters 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          typeFilter={typeFilter}
          onTypeChange={setTypeFilter}
        />

        <MyCommitmentsGrid 
          commitments={filteredCommitments}
          onDetails={(id) => router.push(`/commitments/${id}`)}
          onAttestations={(id) => console.log('Attestations for', id)}
          onEarlyExit={openEarlyExitModal}
        />
      </div>

      {commitmentForEarlyExit && earlyExitSummary && (
        <CommitmentEarlyExitModal
          isOpen={true}
          commitmentId={commitmentForEarlyExit.id}
          originalAmount={`${commitmentForEarlyExit.amount} ${commitmentForEarlyExit.asset}`}
          penaltyPercent={earlyExitSummary.penaltyPercent}
          penaltyAmount={earlyExitSummary.penaltyAmount}
          netReceiveAmount={earlyExitSummary.netReceiveAmount}
          hasAcknowledged={hasAcknowledged}
          onChangeAcknowledged={setHasAcknowledged}
          onCancel={closeEarlyExitModal}
          onConfirm={handleConfirmEarlyExit}
          onClose={closeEarlyExitModal}
        />
      )}
    </main>
  );
}
