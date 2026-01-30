'use client';

import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CommitmentHealthMetrics from '@/components/dashboard/CommitmentHealthMetrics';
import CommitmentDetailAllocationConstraints from '@/components/CommitmentDetailAllocationConstraints';
import { CommitmentDetailNftSection } from '@/components/dashboard/CommitmentDetailNftSection';
import { CommitmentDetailParameters } from '@/components/CommitmentDetailParameters/CommitmentDetailParameters';

// Mock Commitments
const MOCK_COMMITMENTS: Record<
  string,
  { id: string; type: string; duration: number; maxLoss: number; earlyExitPenaltyPercent?: number }
> = {
  '1': { id: '1', type: 'Balanced', duration: 60, maxLoss: 8, earlyExitPenaltyPercent: 3 },
  '2': { id: '2', type: 'Safe', duration: 30, maxLoss: 2, earlyExitPenaltyPercent: 3 },
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

// Mock data for the NFT section
const MOCK_NFT_DATA = {
    tokenId: '123456789',
    ownerAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    mintDate: 'Jan 10, 2026',
};

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

    const durationLabel = `${commitment.duration} days`
    const maxLossLabel = `${commitment.maxLoss}%`
    const commitmentTypeLabel = commitment.type
    const earlyExitPenaltyLabel = `${commitment.earlyExitPenaltyPercent ?? 3}%`
    
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
    const handleViewExplorer = () => console.log('View Explorer clicked');
    const handleTransfer = () => console.log('Transfer clicked');

    return (
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
                                Active • {commitment.type} Strategy
                            </p>
                        </div>
                        <div className="hidden sm:block">
                            <span className="px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-[#0ff0fc] text-sm font-medium">
                                Active
                            </span>
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

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    <div className="lg:col-span-2 space-y-8">
                        <CommitmentHealthMetrics 
                            complianceData={MOCK_COMPLIANCE_DATA}
                            drawdownData={MOCK_DRAWDOWN_DATA}
                            valueHistoryData={MOCK_VALUE_HISTORY_DATA}
                            thresholdPercent={0.5}
                            volatilityPercent={65}
                        />
                        
                        <CommitmentDetailAllocationConstraints 
                            constraints={[
                                { id: '1', text: 'Max 50% allocation to any single protocol' },
                                { id: '2', text: 'Only whitelisted DeFi protocols allowed' },
                                { id: '3', text: 'Minimum 20% must remain in stablecoins' },
                            ]}
                        />
                    </div>

                    <div className="lg:col-span-1 w-full">
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
                    </div>
                </div>
            </div>
        </main>
    );
}
