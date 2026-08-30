'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisputeInfo, SSEConnectionState } from '@/types/dispute';
import { computeReconnectDelay, shouldContinueReconnecting } from './sseBackoff';

interface UseDisputeSSEReturn {
  /** The live-updated dispute info, or null if no dispute is active */
  liveDispute: DisputeInfo | null;
  /** Current state of the SSE connection */
  connectionState: SSEConnectionState;
}

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const RECONNECT_BACKOFF_FACTOR = 2;
/** Upper bound on successive reconnect attempts before giving up. */
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Subscribes to the commitment events SSE stream and extracts
 * dispute-related status changes. When the commitment status transitions
 * to 'Violated', the hook synthesises a live DisputeInfo object that
 * reflects the latest on-chain state.
 *
 * @param commitmentId - The commitment to subscribe to events for.
 * @returns Live dispute info and the current SSE connection state.
 */
export function useDisputeSSE(commitmentId: string): UseDisputeSSEReturn {
  const [liveDispute, setLiveDispute] = useState<DisputeInfo | null>(null);
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('connecting');

  // Bail out early when no valid commitmentId is provided — avoids
  // connecting to an invalid URL and consuming unnecessary resources.
  const hasValidId = Boolean(commitmentId);

  // Refs that persist across re-renders but don't trigger them
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!commitmentId) return;

    // Clean up any previous connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setConnectionState(reconnectAttemptRef.current === 0 ? 'connecting' : 'reconnecting');

    const url = `/api/commitments/${encodeURIComponent(commitmentId)}/events`;

    fetch(url, {
      signal: controller.signal,
      credentials: 'include',
      headers: { Accept: 'text/event-stream' },
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        // Connection established — mark as live
        if (isMountedRef.current) {
          setConnectionState('live');
          reconnectAttemptRef.current = 0;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE messages from the buffer
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() ?? '';

          let currentEventType = '';
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
            } else if (line === '') {
              // Empty line = end of an SSE message block
              if (currentEventType && currentData) {
                try {
                  const payload = JSON.parse(currentData);

                  if (currentEventType === 'snapshot' && payload.status === 'Violated') {
                    setLiveDispute({
                      stage: 'under_review',
                      filedAt: payload.timestamp,
                      reasonCategory: 'On-chain violation detected',
                    });
                  } else if (currentEventType === 'status_change') {
                    if (payload.status === 'Violated') {
                      setLiveDispute((prev) => ({
                        stage: 'under_review',
                        filedAt: payload.timestamp,
                        reasonCategory: prev?.reasonCategory ?? 'On-chain violation detected',
                      }));
                    } else if (
                      payload.status === 'Settled' ||
                      payload.status === 'Active' ||
                      payload.status === 'Early Exit'
                    ) {
                      // Dispute may have been resolved if we transition away from Violated
                      setLiveDispute((prev) =>
                        prev
                          ? {
                              ...prev,
                              stage: 'resolved',
                              resolvedAt: payload.timestamp,
                              resolution: `Status changed to ${payload.status}`,
                            }
                          : null,
                      );
                    }
                  }
                } catch {
                  // Ignore malformed JSON payloads
                }
              }

              currentEventType = '';
              currentData = '';
            }
          }
        }
      })
      .catch((error) => {
        if ((error as Error).name === 'AbortError') return;

        // Attempt reconnection with bounded exponential backoff.
        reconnectAttemptRef.current += 1;

        if (!isMountedRef.current) return;

        if (!shouldContinueReconnecting(reconnectAttemptRef.current, MAX_RECONNECT_ATTEMPTS)) {
          // Give up. Leave the state as 'reconnecting' so the UI does not
          // falsely report 'live'; no further timers or fetches are scheduled,
          // which bounds network/CPU cost on an unhealthy stream.
          setConnectionState('reconnecting');
          return;
        }

        const delay = computeReconnectDelay(
          reconnectAttemptRef.current,
          RECONNECT_BASE_DELAY_MS,
          RECONNECT_BACKOFF_FACTOR,
          RECONNECT_MAX_DELAY_MS,
        );

        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            connect();
          }
        }, delay);
      });
  }, [commitmentId]);

  useEffect(() => {
    if (!hasValidId) {
      setConnectionState('live');
      setLiveDispute(null);
      return;
    }

    isMountedRef.current = true;
    reconnectAttemptRef.current = 0;
    connect();

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect, hasValidId]);

  return { liveDispute, connectionState };
}
