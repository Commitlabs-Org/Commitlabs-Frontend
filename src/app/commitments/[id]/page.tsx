'use client';

import React, { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CommitmentHealthMetrics from '@/components/dashboard/CommitmentHealthMetrics';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import CommitmentDetailAllocationConstraints from '@/components/CommitmentDetailAllocationConstraints';
import { CommitmentDetailNftSection } from '@/components/dashboard/CommitmentDetailNftSection';
import { CommitmentDetailParameters } from '@/components/CommitmentDetailParameters/CommitmentDetailParameters';
import { CommitmentDetailActions } from '@/components/CommitmentDetailActions';
import RecentAttestationsPanel from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';
import ExportCommitmentsModal from '@/components/export/ExportCommitmentsModal';
import CommitmentEarlyExitModal from '@/components/CommitmentEarlyExitModal/CommitmentEarlyExitModal';
import DisputeModal from '@/components/modals/DisputeModal';
import DisputeStatusTracker, { type DisputeInfo } from '@/components/dispute/DisputeStatusTracker';
import { openExplorerUrl } from '@/utils/explorerLinks';
import { CommitmentStatusProvider, useCommitmentStatus } from '@/context/CommitmentStatusContext';

// Mock Commitments
const MOCK_COMMITMENTS: Record<
  string,
  { id: string; type: string; duration: number; maxLoss: number; earlyExitPenaltyPercent?: number; canEarlyExit: boolean }
> = {
  '1': { id: '1', type: 'Balanced', duration: 60, maxLoss: 8, earlyExitPenaltyPercent: 3, canEarlyExit: true },
  '2': { id: '2', type: 'Safe', duration: 30, maxLoss: 2, earlyExitPenaltyPercent: 3, canEarlyExit: false },
};

// Mock dispute state — populated from /api/commitments/[id] status + history in production
const MOCK_DISPUTES: Record<string, DisputeInfo | null> = {
  '1': {
    stage: 'under_review',
    filedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    reasonCategory: 'Compliance violation',
    reviewStartedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  '2': null,
};

// Mock data for health metrics
const MOCK_COMPLIANCE_DATA = [
    { date: 'Jan 1', complianceScore: 98 },
    { date: 'Jan 5', complianceScore: 97 },
    { date: 'Jan 10', complianceScore: 99 },
    { date: 'Jan 15', complianceScore: 95 },
    { date: 'Jan 20', complianceScore: 98 },
    { date: 'Jan 25', complianceScore: 100 },
    { date: 'Jan 30', complianceScore: 99 },
];

const MOCK_DRAWDOWN_DATA = [
    { date: 'Jan 10', drawdownPercent: 0 },
    { date: 'Jan 15', drawdownPercent: 0.35 },
    { date: 'Jan 20', drawdownPercent: 0.58 },
    { date: 'Jan 25', drawdownPercent: 0.52 },
    { date: 'Jan 28', drawdownPercent: 0.78 },
];

const MOCK_VALUE_HISTORY_DATA = [
    { date: 'Jan 10', currentValue: 50000, initialAmount: 50000 },
    { date: 'Jan 15', currentValue: 52000, initialAmount: 50000 },
    { date: 'Jan 20', currentValue: 51500, initialAmount: 50000 },
    { date: 'Jan 25', currentValue: 53000, initialAmount: 50000 },
    { date: 'Jan 28', currentValue: 54000, initialAmount: 50000 },
];

const MOCK_FEE_GENERATION_DATA = [
    { date: 'Jan 10', feeAmount: 25 },
    { date: 'Jan 15', feeAmount: 45 },
    { date: 'Jan 20', feeAmount: 78 },
    { date: 'Jan 25', feeAmount: 92 },
    { date: 'Jan 28', feeAmount: 125 },
];

const MOCK_ATTESTATIONS = [
    {
        id: '1',
        title: 'Daily Compliance Check',
        description: 'All parameters within acceptable ranges. No violations detected.',
        txHash: '0xabcdef1234567890abcdef1234567890',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        severity: 'ok' as const,
    },
    {
        id: '2',
        title: 'Allocation Verified',
        description: 'Portfolio allocation meets all constraints. Safe protocol usage confirmed.',
        txHash: '0x123456789abcdef123456789abcdef',
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
        severity: 'ok' as const,
    },
    {
        id: '3',
        title: 'Increased Volatility',
        description: 'Market volatility increased. Monitoring drawdown levels closely.',
        txHash: '0x567890abcdef1234567890abcdef1234',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        severity: 'warning' as const,
    },
    {
        id: '4',
        title: 'Weekly Review',
        description: 'Commitment performing well. All rules followed consistently.',
        txHash: '0x90abcd1234567890abcd345678',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        severity: 'ok' as const,
    },
    {
        id: '5',
        title: 'Commitment Created',
        description: 'Initial commitment parameters set and validated on-chain.',
        txHash: '0xdef1234567890abcdef890abc',
        timestamp: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
        severity: 'ok' as const,
    },
];

const MOCK_ATTESTATION_SUMMARY = {
    complianceCount: 4,
    warningCount: 1,
    violationCount: 0,
};

// Mock data for the NFT section
const MOCK_NFT_DATA = {
    tokenId: '123456789',
    ownerAddress: `G${'A'.repeat(55)}`,
    contractAddress: `C${'B'.repeat(55)}`,
    mintDate: 'Jan 10, 2026',
};

const MOCK_OWNER_ADDRESS = `G${'A'.repeat(55)}`;

function getCommitmentById(id: string) {
  return MOCK_COMMITMENTS[id] ?? null;
}

export default function CommitmentDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const commitment = getCommitmentById(params.id)
    if (!commitment) notFound()

    const [dispute, setDispute] = useState<DisputeInfo | null>(() => MOCK_DISPUTES[params.id] ?? null);
    const [commitmentStatusOverride, setCommitmentStatusOverride] = useState<string | null>(null);

    const durationLabel = `${commitment.duration} days`
    const maxLossLabel = `${commitment.maxLoss}%`
    const commitmentTypeLabel = commitment.type
    const earlyExitPenaltyLabel = `${commitment.earlyExitPenaltyPercent ?? 3}%`
    const { canEarlyExit } = commitment

    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [earlyExitModalOpen, setEarlyExitModalOpen] = useState(false);
    const [disputeModalOpen, setDisputeModalOpen] = useState(false);

    const attestationsRef = useRef<HTMLDivElement>(null);

    const handleCopy = async (text: string, label: string) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                alert(`${label} Copied!`); 
            } catch (err) {
                console.error('Failed to copy!', err);
            }
        }
    };

    const handleViewDetails = () => console.log('View Details clicked');
    const handleViewExplorer = () => openExplorerUrl('contract', MOCK_NFT_DATA.contractAddress, 'testnet');
    const handleTransfer = () => console.log('Transfer clicked');

    const handleViewAttestations = useCallback(() => {
        attestationsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleExportData = useCallback(() => {
        setExportModalOpen(true);
    }, []);

    const handleReportIssue = useCallback(() => {
        setDisputeModalOpen(true);
    }, []);

    const handleDisputeSubmitted = useCallback(() => {
        setDispute({
            stage: 'under_review',
            filedAt: new Date().toISOString(),
            reasonCategory: 'Pending review',
            reviewStartedAt: new Date().toISOString(),
        });
        setCommitmentStatusOverride('Disputed');
        setDisputeModalOpen(false);
    }, []);

    const handleEarlyExit = useCallback(() => {
        setEarlyExitModalOpen(true);
    }, []);

    const handleSettle = useCallback(() => {
        console.log('Settle clicked for commitment', commitment.id);
    }, [commitment.id]);

    return (
        <CommitmentStatusProvider commitmentId={commitment.id}>
            <main id="main-content" className="min-h-screen bg-[#050505] text-[#f5f5f7] p-4 sm:p-8 lg:p-12">
                <div className="max-w-7xl mx-auto space-y-8">
                    
                    <header className="flex flex-col gap-4">
                        <Link
                            href="/commitments"
                            className="text-[#666] hover:text-[#0ff0fc] transition-colors text-sm w-fit"
                            aria-label="Back to My Commitments"
                        >
                            ← Back to My Commitments
                        </Link>
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-linear-to-b from-white to-[#99a1af]">
                                    {commitment.type} Commitment #{commitment.id}
                                </h1>
                                <p className="text-[#99a1af] mt-2">
                                    {commitment.type} Strategy
                                </p>
                            </div>
                            <div className="hidden sm:block">
                                <StatusBadge statusOverride={commitmentStatusOverride ?? undefined} />
                            </div>
                        </div>
                    </header>

                    <div className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]">
                        <CommitmentDetailParameters
                            durationLabel={durationLabel}
                            maxLossLabel={maxLossLabel}
                            commitmentTypeLabel={commitmentTypeLabel}
                            earlyExitPenaltyLabel={earlyExitPenaltyLabel}
                        />
                    </div>

                    <DisputeStatusTracker dispute={dispute} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 space-y-8">
                            <ErrorBoundary>
                                <CommitmentHealthMetrics
                                    commitmentId={params.id}
                                    complianceData={MOCK_COMPLIANCE_DATA}
                                    drawdownData={MOCK_DRAWDOWN_DATA}
                                    valueHistoryData={MOCK_VALUE_HISTORY_DATA}
                                    feeGenerationData={MOCK_FEE_GENERATION_DATA}
                                    thresholdPercent={0.5}
                                    volatilityPercent={35}
                                />
                            </ErrorBoundary>

                            <div ref={attestationsRef} id="attestations-section">
                                <RecentAttestationsPanel
                                    attestations={MOCK_ATTESTATIONS}
                                    summary={MOCK_ATTESTATION_SUMMARY}
                                    onSelectAttestation={(id) => console.log('Selected attestation:', id)}
                                    onViewAll={() => console.log('View all attestations')}
                                />
                            </div>
                            
                            <CommitmentDetailAllocationConstraints 
                                constraints={[
                                    { id: '1', text: 'Max 50% allocation to any single protocol' },
                                    { id: '2', text: 'Only whitelisted DeFi protocols allowed' },
                                    { id: '3', text: 'Minimum 20% must remain in stablecoins' },
                                ]}
                            />
                        </div>

                        <div className="lg:col-span-1 w-full space-y-8">
                            <CommitmentDetailNftSection 
                                tokenId={MOCK_NFT_DATA.tokenId}
                                ownerAddress={MOCK_NFT_DATA.ownerAddress}
                                contractAddress={MOCK_NFT_DATA.contractAddress}
                                mintDate={MOCK_NFT_DATA.mintDate}
                                onCopyTokenId={() => handleCopy(MOCK_NFT_DATA.tokenId, 'Token ID')}
                                onCopyOwner={() => handleCopy(MOCK_NFT_DATA.ownerAddress, 'Owner Address')}
                                onCopyContract={() => handleCopy(MOCK_NFT_DATA.contractAddress, 'Contract Address')}
                                onViewDetails={handleViewDetails}
                                onViewOnExplorer={handleViewExplorer}
                                onTransfer={handleTransfer}
                            />

                            <CommitmentDetailActionsUsingContext
                                onEarlyExit={handleEarlyExit}
                                onViewAttestations={handleViewAttestations}
                                onExportData={handleExportData}
                                onReportIssue={handleReportIssue}
                                onSettle={handleSettle}
                                commitmentId={commitment.id}
                            />
                        </div>
                    </div>
                </div>

                <ExportCommitmentsModal
                    isOpen={exportModalOpen}
                    onClose={() => setExportModalOpen(false)}
                    ownerAddress={MOCK_OWNER_ADDRESS}
                />

                {earlyExitModalOpen && (
                    <CommitmentEarlyExitModal
                        isOpen={earlyExitModalOpen}
                        commitmentId={commitment.id}
                        originalAmount="50,000 XLM"
                        penaltyPercent={earlyExitPenaltyLabel}
                        penaltyAmount="1,500 XLM"
                        netReceiveAmount="48,500 XLM"
                        hasAcknowledged={false}
                        onChangeAcknowledged={() => {}}
                        onCancel={() => setEarlyExitModalOpen(false)}
                        onConfirm={() => {
                            setEarlyExitModalOpen(false);
                        }}
                    />
                )}

                <DisputeModal
                    isOpen={disputeModalOpen}
                    commitmentId={commitment.id}
                    onClose={() => setDisputeModalOpen(false)}
                    onSubmitted={handleDisputeSubmitted}
                />
            </main>
        </CommitmentStatusProvider>
    );

function StatusBadge({ statusOverride }: { statusOverride?: string }) {
    const { status, isLoading } = useCommitmentStatus();
    if (isLoading || !status) {
        return (
            <span className="px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-[#99a1af] text-sm font-medium">
                Loading...
            </span>
        );
    }
    const visibleStatus = statusOverride ?? status.status;
    const getStatusColor = (label: string) => {
        switch (label.toLowerCase()) {
            case 'active':
                return 'text-[#0ff0fc] border-[#0ff0fc]/30';
            case 'settled':
                return 'text-[#4ade80] border-[#4ade80]/30';
            case 'violated':
            case 'disputed':
                return 'text-[#f87171] border-[#f87171]/30';
            case 'early exit':
            case 'under review':
                return 'text-[#fbbf24] border-[#fbbf24]/30';
            default:
                return 'text-[#99a1af] border-[#222]';
        }
    };
    return (
        <span className={`px-4 py-2 bg-[#1a1a1a] border rounded-lg text-sm font-medium ${getStatusColor(visibleStatus)}`}>
            {visibleStatus}
        </span>
    );
}

function CommitmentDetailActionsUsingContext({
    onEarlyExit,
    onViewAttestations,
    onExportData,
    onReportIssue,
    onSettle,
    commitmentId,
}: {
    onEarlyExit: () => void;
    onViewAttestations: () => void;
    onExportData: () => void;
    onReportIssue: () => void;
    onSettle?: () => void;
    commitmentId?: string;
}) {
    const { status } = useCommitmentStatus();
    const canEarlyExit = status ? (status.status.toLowerCase() === 'active' && status.daysRemaining > 0) : false;
    const previewRefreshTrigger = status ? `${status.status}:${status.expiresAt ?? 'none'}` : 'loading';
    
    return (
        <CommitmentDetailActions
            canEarlyExit={canEarlyExit}
            onEarlyExit={onEarlyExit}
            onViewAttestations={onViewAttestations}
            onExportData={onExportData}
            onReportIssue={onReportIssue}
            onSettle={onSettle}
            commitmentId={commitmentId}
            previewRefreshTrigger={previewRefreshTrigger}
        />
    );
}
}
