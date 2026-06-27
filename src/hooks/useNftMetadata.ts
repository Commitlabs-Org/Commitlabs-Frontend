'use client';

import { useState, useCallback } from 'react';

interface UseNftMetadataOptions {
  tokenId: string;
  metadataUrl?: string;
}

interface UseNftMetadataReturn {
  metadata: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useNftMetadata({
  tokenId,
  metadataUrl,
}: UseNftMetadataOptions): UseNftMetadataReturn {
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!metadataUrl) {
      setMetadata(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(metadataUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setMetadata(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setMetadata(null);
    } finally {
      setIsLoading(false);
    }
  }, [metadataUrl]);

  return {
    metadata,
    isLoading,
    error,
    refresh: fetchMetadata,
  };
}
