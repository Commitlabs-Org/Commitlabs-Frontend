'use client';

import { useEffect, useRef, useState } from 'react';
import type { DisputeInfo } from '@/components/dispute/DisputeStatusTracker';

interface UseDisputeSSEOptions {
  commitmentId: string;
  initialDispute: DisputeInfo | null;
  /** Override the SSE endpoint (defaults to /api/events?commitmentId=<id>). */
  endpoint?: string;
}

interface UseDisputeSSEResult {
  dispute: DisputeInfo | null;
  connected: boolean;
  error: string | null;
}

/**
 * Subscribes to the server-sent events (SSE) endpoint for dispute-status updates.
 * Falls back gracefully when EventSource is unavailable (SSR, old browsers).
 */
export function useDisputeSSE({
  commitmentId,
  initialDispute,
  endpoint,
}: UseDisputeSSEOptions): UseDisputeSSEResult {
  const [dispute, setDispute] = useState<DisputeInfo | null>(initialDispute);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (typeof EventSource === 'undefined') return;

    const url = endpoint ?? `/api/events?commitmentId=${encodeURIComponent(commitmentId)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener('open', () => {
      setConnected(true);
      setError(null);
    });

    es.addEventListener('dispute_update', (event: MessageEvent) => {
      try {
        const updated: DisputeInfo = JSON.parse(event.data);
        setDispute(updated);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('error', () => {
      setConnected(false);
      setError('Connection lost. Retrying…');
    });

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [commitmentId, endpoint]);

  return { dispute, connected, error };
}
