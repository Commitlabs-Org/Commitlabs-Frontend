'use client';

import React, { useMemo, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, Share2 } from 'lucide-react';
import { buildExplorerUrl, type ExplorerNetwork } from '@/utils/explorerLinks';

interface CommitmentDetailHeaderProps {
    commitmentId: string;
    statusLabel: string;
    statusVariant: 'active' | 'settled' | 'violated' | 'early_exit' | string;
    onBack: () => void;
    onShare: () => void;
    explorerId?: string | null;
    explorerNetwork?: ExplorerNetwork;
}

const statusConfig = {
    active: {
        color: 'text-[#0ff0fc]',
        bg: 'bg-[#0ff0fc]/10',
        border: 'border-[#0ff0fc]/20',
        dotColor: 'bg-[#0ff0fc]',
    },
    settled: {
        color: 'text-[#4ade80]',
        bg: 'bg-[#4ade80]/10',
        border: 'border-[#4ade80]/20',
        dotColor: 'bg-[#4ade80]',
    },
    violated: {
        color: 'text-[#ef4444]',
        bg: 'bg-[#ef4444]/10',
        border: 'border-[#ef4444]/20',
        dotColor: 'bg-[#ef4444]',
    },
    early_exit: {
        color: 'text-[#f59e0b]',
        bg: 'bg-[#f59e0b]/10',
        border: 'border-[#f59e0b]/20',
        dotColor: 'bg-[#f59e0b]',
    },
} as const;

export default function CommitmentDetailHeader({
    commitmentId,
    statusLabel,
    statusVariant,
    onBack,
    onShare,
    explorerId,
    explorerNetwork = 'testnet',
}: CommitmentDetailHeaderProps) {
    const config = statusConfig[statusVariant as keyof typeof statusConfig] || statusConfig.active;
    const [copied, setCopied] = useState(false);

    const explorerUrl = useMemo(
        () => buildExplorerUrl('contract', explorerId ?? commitmentId, explorerNetwork),
        [commitmentId, explorerId, explorerNetwork],
    );

    const handleCopyCommitmentId = async () => {
        if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
            return;
        }

        try {
            await navigator.clipboard.writeText(commitmentId);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy commitment id:', error);
        }
    };

    return (
        <header className="w-full space-y-4 sm:space-y-6">
            {/* Back Navigation */}
            <button
                onClick={onBack}
                className="group flex items-center gap-2 text-sm text-[#666] hover:text-[#0ff0fc] transition-all duration-200 focus:outline-none focus:text-[#0ff0fc] focus:drop-shadow-[0_0_8px_rgba(15,240,252,0.4)]"
                aria-label="Go back to My Commitments"
            >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="group-hover:underline">Back to My Commitments</span>
            </button>

            {/* Main Header Content */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Left Section: ID and Status */}
                <div className="flex flex-col gap-3">
                    {/* Commitment ID */}
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-mono uppercase tracking-tight text-[#f5f5f7] truncate max-w-full">
                            {commitmentId}
                        </h1>

                        <div className="flex flex-wrap items-center gap-2" aria-label="Commitment id actions">
                            <button
                                type="button"
                                onClick={handleCopyCommitmentId}
                                disabled={typeof navigator !== 'undefined' && !navigator.clipboard?.writeText}
                                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0a0a] border border-[#222] text-[#99a1af] text-xs font-medium hover:border-[#0ff0fc]/40 hover:text-[#0ff0fc] hover:bg-[#0ff0fc]/5 transition-all duration-200 focus:outline-none focus:border-[#0ff0fc]/60 focus:text-[#0ff0fc] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#222] disabled:hover:text-[#99a1af] disabled:hover:bg-[#0a0a0a]"
                                aria-label="Copy full commitment id"
                            >
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{copied ? 'Copied' : 'Copy ID'}</span>
                            </button>

                            <span className="sr-only" role="status" aria-live="polite">
                                {copied ? 'Commitment id copied' : ''}
                            </span>

                            {explorerUrl ? (
                                <a
                                    href={explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0a0a0a] border border-[#222] text-[#99a1af] text-xs font-medium hover:border-[#0ff0fc]/40 hover:text-[#0ff0fc] hover:bg-[#0ff0fc]/5 transition-all duration-200 focus:outline-none focus:border-[#0ff0fc]/60 focus:text-[#0ff0fc]"
                                    aria-label="Open commitment on Stellar Explorer"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Explorer</span>
                                </a>
                            ) : null}
                        </div>
                    </div>

                    {/* Status Pill */}
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit ${config.bg} ${config.border} border`}>
                        <span className={`w-2 h-2 rounded-full ${config.dotColor} animate-pulse`} aria-hidden="true" />
                        <span className={`text-sm font-medium ${config.color}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                {/* Right Section: Share Button */}
                <button
                    onClick={onShare}
                    className="group flex items-center gap-2 px-4 py-2.5 bg-[#0a0a0a] border border-[#222] rounded-full text-[#f5f5f7] text-sm font-medium hover:border-[#0ff0fc]/40 hover:bg-[#0ff0fc]/5 hover:shadow-[0_0_20px_rgba(15,240,252,0.15)] hover:-translate-y-0.5 transition-all duration-200 focus:outline-none focus:border-[#0ff0fc]/60 focus:shadow-[0_0_24px_rgba(15,240,252,0.25)] w-full sm:w-auto justify-center sm:justify-start"
                    aria-label="Share commitment"
                >
                    <Share2 className="w-4 h-4 group-hover:rotate-6 transition-transform" />
                    <span>Share</span>
                </button>
            </div>
        </header>
    );
}
