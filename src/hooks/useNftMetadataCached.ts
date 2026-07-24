'use client';

import { useState, useCallback, useRef } from 'react';

interface UseNftMetadataOptions {
  tokenId: string;
  metadataUrl?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

interface UseNftMetadataReturn {
  metadata: Record<string, unknown> | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const memCache = new Map<string, Record<string, unknown>>();

async function fetchWithBackoff(
  url: string,
  maxRetries: number,
  delayMs: number,
): Promise<Record<string, unknown>> {
  let attempt = 0;
  while (true) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) return response.json() as Promise<Record<string, unknown>>;
    if (response.status < 500 || attempt >= maxRetries) {
      throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    }
    await new Promise((r) => setTimeout(r, delayMs * 2 ** attempt));
    attempt++;
  }
}

export function useNftMetadataCached({
  tokenId,
  metadataUrl,
  maxRetries = 3,
  retryDelayMs = 500,
}: UseNftMetadataOptions): UseNftMetadataReturn {
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(
    () => (metadataUrl ? (memCache.get(metadataUrl) ?? null) : null),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);

  const fetchMetadata = useCallback(async () => {
    if (!metadataUrl) {
      setMetadata(null);
      setError(null);
      return;
    }

    if (inflightRef.current) return inflightRef.current;

    const cached = memCache.get(metadataUrl);
    if (cached) {
      setMetadata(cached);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const promise = fetchWithBackoff(metadataUrl, maxRetries, retryDelayMs)
      .then((data) => {
        memCache.set(metadataUrl, data);
        setMetadata(data);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMetadata(null);
      })
      .finally(() => {
        setIsLoading(false);
        inflightRef.current = null;
      });

    inflightRef.current = promise;
    return promise;
  }, [metadataUrl, maxRetries, retryDelayMs]);

  return { metadata, isLoading, error, refresh: fetchMetadata };
}
