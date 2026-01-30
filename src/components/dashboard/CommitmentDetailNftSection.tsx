'use client';
import React from 'react';
import { Copy, ExternalLink, Send } from 'lucide-react';

interface CommitmentDetailNftSectionProps {
  tokenId: string;
  ownerAddress: string;
  contractAddress: string;
  mintDate: string;
  onCopyTokenId: () => void;
  onCopyOwner: () => void;
  onCopyContract: () => void;
  onViewDetails: () => void;
  onViewOnExplorer: () => void;
  onTransfer: () => void;
}

export const CommitmentDetailNftSection: React.FC<CommitmentDetailNftSectionProps> = ({
  tokenId,
  ownerAddress,
  contractAddress,
  mintDate,
  onCopyTokenId,
  onCopyOwner,
  onCopyContract,
  onViewDetails,
  onViewOnExplorer,
  onTransfer,
}) => {
  return (
    <section className="w-full space-y-6">
      <h2 className="text-xl font-bold text-white">NFT</h2>


      <div className="relative flex flex-col items-center justify-center p-8 overflow-hidden rounded-2xl bg-linear-to-b from-slate-800 to-black border border-white/10">

        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-teal-500/10 via-purple-500/10 to-transparent pointer-events-none" />


        <div className="relative z-10 flex items-center justify-center w-24 h-24 mb-4 rounded-full border-2 border-teal-500/50 bg-slate-900/50 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
          <span className="text-4xl font-bold text-teal-400">C</span>
        </div>

        <div className="relative z-10 text-center">
          <p className="text-sm font-medium text-slate-400">Commitment NFT</p>
          <p className="text-lg font-bold text-white mt-1">#{tokenId}</p>
        </div>
      </div>

      {/* 2. Metadata Section */}
      <div className="p-6 rounded-2xl bg-[#0F1115] border border-white/5">
        <h3 className="mb-4 text-sm font-semibold text-white">NFT Metadata</h3>

        <div className="space-y-4">
          <MetadataRow
            label="Token ID"
            value={tokenId}
            onCopy={onCopyTokenId}
          />
          <MetadataRow
            label="Owner"
            value={ownerAddress}
            isAddress
            onCopy={onCopyOwner}
          />
          <MetadataRow
            label="Contract Address"
            value={contractAddress}
            isAddress
            onCopy={onCopyContract}
          />
          <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-slate-400">Mint Date</span>
            <span className="text-sm font-medium text-white font-mono">{mintDate}</span>
          </div>
        </div>
      </div>

      {/* 3. Action Buttons */}
      <div className="flex flex-col gap-3">
        <ActionButton
          icon={<ExternalLink className="w-4 h-4 text-[#0FF0FC]" />}
          label="View NFT Details"
          onClick={onViewDetails}
        />
        <ActionButton
          icon={<ExternalLink className="w-4 h-4 text-[#0FF0FC]" />}
          label="View on Explorer"
          onClick={onViewOnExplorer}
        />
        <ActionButton
          icon={<Send className="w-4 h-4 text-[#C27AFF]" />}
          label="Transfer NFT"
          onClick={onTransfer}

        />
      </div>
    </section>
  );
};

// --- Helper Components for Clean Code ---

const MetadataRow = ({ label, value, isAddress = false, onCopy }: { label: string, value: string, isAddress?: boolean, onCopy: () => void }) => (
  <div className="flex justify-between items-center py-2 border-b border-white/5">
    <span className="text-sm text-slate-400">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-sm font-medium text-white ${isAddress ? 'font-mono' : ''}`}>
        {/* Simple truncation for addresses */}
        {isAddress && value.length > 12
          ? `${value.slice(0, 6)}...${value.slice(-4)}`
          : value}
      </span>
      <button
        onClick={onCopy}
        className="text-slate-500 hover:text-white transition-colors"
        aria-label={`Copy ${label}`}
      >
        <Copy className="w-4 h-4" />
      </button>
    </div>
  </div>
);

const ActionButton = ({ icon, label, onClick, variant = 'default' }: { icon: React.ReactNode, label: string, onClick: () => void, variant?: 'default' | 'primary' }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center justify-center w-full gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all
      ${variant === 'primary'
        ? 'bg-teal-900/20 text-teal-400 border border-teal-500/20 hover:bg-teal-900/40'
        : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'}
    `}
  >
    {icon}
    {label}
  </button>
);