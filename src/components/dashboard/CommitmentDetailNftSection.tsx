'use client';

import React from 'react';

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

export function CommitmentDetailNftSection({
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
}: CommitmentDetailNftSectionProps) {
  return (
    <section
      className="bg-[#0a0a0a] rounded-2xl p-6 border border-[#222]"
      aria-label="Commitment NFT"
    >
      <h2 className="text-white text-lg font-semibold mb-4">NFT Certificate</h2>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Token</span>
          <button onClick={onCopyTokenId} className="text-white hover:text-[#0FF0FC]">
            {tokenId.slice(0, 8)}…
          </button>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Owner</span>
          <button onClick={onCopyOwner} className="text-white hover:text-[#0FF0FC]">
            {ownerAddress.slice(0, 8)}…
          </button>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Contract</span>
          <button onClick={onCopyContract} className="text-white hover:text-[#0FF0FC]">
            {contractAddress.slice(0, 8)}…
          </button>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Minted</span>
          <span className="text-white">{mintDate}</span>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <button
          onClick={onViewDetails}
          className="w-full py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm hover:bg-[#1a1a1a]"
        >
          View Details
        </button>
        <button
          onClick={onViewOnExplorer}
          className="w-full py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm hover:bg-[#1a1a1a]"
        >
          View on Explorer
        </button>
        <button
          onClick={onTransfer}
          className="w-full py-2 rounded-lg bg-[#161616] border border-[#232323] text-white text-sm hover:bg-[#1a1a1a]"
        >
          Transfer
        </button>
      </div>
    </section>
  );
}
