'use client';

import React from 'react';
import Link from 'next/link';
import CommitmentHealthMetrics from '../../../components/dashboard/CommitmentHealthMetrics';
import { CommitmentDetailNftSection } from '@/components/dashboard/CommitmentDetailNftSection';


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

// Mock data for the NFT section
const MOCK_NFT_DATA = {
    tokenId: '123456789',
    ownerAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    mintDate: 'Jan 10, 2026',
};

export default function CommitmentDetailPage({
    params,
}: {
    params: { id: string };
}) {
    
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
        <main className="min-h-screen bg-[#050505] text-[#f5f5f7] p-4 sm:p-8 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                
                <header className="flex flex-col gap-4">
                    <Link
                        href="/commitments"
                        className="text-[#666] hover:text-[#0ff0fc] transition-colors text-sm w-fit"
                    >
                        ← Back to Commitments
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-linear-to-b from-white to-[#99a1af]">
                                Commitment #{params.id}
                            </h1>
                            <p className="text-[#99a1af] mt-2">
                                Active • Balanced Strategy
                            </p>
                        </div>
                        <div className="hidden sm:block">
                            <span className="px-4 py-2 bg-[#1a1a1a] border border-[#222] rounded-lg text-[#0ff0fc] text-sm font-medium">
                                Active
                            </span>
                        </div>
                    </div>
                </header>

                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                    
                    
                    <div className="lg:col-span-2">
                        <CommitmentHealthMetrics complianceData={MOCK_COMPLIANCE_DATA} />
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