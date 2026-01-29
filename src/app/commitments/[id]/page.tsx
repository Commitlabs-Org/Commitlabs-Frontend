'use client';

import React from 'react';
import Link from 'next/link';
import CommitmentHealthMetrics from '../../../components/dashboard/CommitmentHealthMetrics';

// Mock data for the commitment
const MOCK_COMPLIANCE_DATA = [
    { date: 'Jan 1', complianceScore: 98 },
    { date: 'Jan 5', complianceScore: 97 },
    { date: 'Jan 10', complianceScore: 99 },
    { date: 'Jan 15', complianceScore: 95 },
    { date: 'Jan 20', complianceScore: 98 },
    { date: 'Jan 25', complianceScore: 100 },
    { date: 'Jan 30', complianceScore: 99 },
];

export default function CommitmentDetailPage({
    params,
}: {
    params: { id: string };
}) {
    return (
        <main className="min-h-screen bg-[#050505] text-[#f5f5f7] p-4 sm:p-8 lg:p-12">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header className="flex flex-col gap-4">
                    <Link
                        href="/commitments"
                        className="text-[#666] hover:text-[#0ff0fc] transition-colors text-sm w-fit"
                    >
                        ← Back to Commitments
                    </Link>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-[#99a1af]">
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

                {/* Health Metrics Section */}
                <section>
                    <CommitmentHealthMetrics complianceData={MOCK_COMPLIANCE_DATA} />
                </section>
            </div>
        </main>
    );
}
