'use client';

import React, { useState, useCallback } from 'react';
import { RefreshCw, Copy, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from './toast/ToastProvider';
import { useNftMetadata } from '@/hooks/useNftMetadata';

interface NFTDisplayProps {
  tokenId: string;
  metadata?: Record<string, unknown>;
  metadataUrl?: string;
  imageUrl?: string;
}

export default function NFTDisplay({
  tokenId,
  metadata: initialMetadata,
  metadataUrl,
  imageUrl,
}: NFTDisplayProps) {
  const toast = useToast();
  const [imageError, setImageError] = useState(false);

  const {
    metadata: fetchedMetadata,
    isLoading,
    error,
    refresh,
  } = useNftMetadata({ tokenId, metadataUrl });

  const metadata = initialMetadata ?? fetchedMetadata;

  const handleCopyTokenId = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(tokenId);
        toast.success({
          title: 'Token ID copied!',
          description: `Token ID "${tokenId}" copied to clipboard.`,
        });
      } else {
        throw new Error('Clipboard API not available');
      }
    } catch (err) {
      toast.error({
        title: 'Failed to copy',
        description: 'Could not copy token ID to clipboard.',
      });
    }
  }, [tokenId, toast]);

  const handleRefresh = useCallback(async () => {
    try {
      await refresh();
      toast.success({
        title: 'Metadata refreshed',
        description: 'NFT metadata has been updated.',
      });
    } catch (err) {
      // Error is already set in useNftMetadata
    }
  }, [refresh, toast]);

  const focusRing =
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050505]';

  return (
    <div className="w-full space-y-4">
      {/* NFT Image */}
      <div className="relative flex items-center justify-center w-full aspect-square rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/10">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="w-8 h-8 text-[#0FF0FC] animate-spin" />
          </div>
        )}
        {(!imageError && imageUrl) ? (
          <img
            src={imageUrl}
            alt={`NFT ${tokenId}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white/50">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-500/20 to-purple-500/20 flex items-center justify-center mb-2">
              <span className="text-2xl font-bold text-teal-400">C</span>
            </div>
            <span className="text-sm">Commitment NFT</span>
          </div>
        )}
      </div>

      {/* Token ID */}
      <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#1a1a1a] border border-white/5">
        <div>
          <p className="text-xs text-white/50 uppercase tracking-wider">Token ID</p>
          <p className="text-sm font-mono text-white">{tokenId}</p>
        </div>
        <button
          onClick={handleCopyTokenId}
          className={`p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors ${focusRing}`}
          aria-label="Copy Token ID"
          title="Copy Token ID"
        >
          <Copy className="w-4 h-4 text-white/70" />
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-400">Failed to load metadata</p>
            <p className="text-xs text-red-300/70 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleRefresh}
          disabled={isLoading || !metadataUrl}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
            isLoading || !metadataUrl
              ? 'bg-white/5 border-white/10 opacity-50 cursor-not-allowed'
              : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
          } ${focusRing}`}
          aria-label="Refresh metadata"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-white/70 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 text-white/70" />
          )}
          <span className="text-sm font-medium text-white/90">
            {isLoading ? 'Refreshing...' : 'Refresh Metadata'}
          </span>
        </button>
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="p-4 rounded-xl bg-[#1a1a1a] border border-white/5">
          <p className="text-xs text-white/50 uppercase tracking-wider mb-3">Metadata</p>
          <pre className="text-xs text-white/80 overflow-x-auto">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}


