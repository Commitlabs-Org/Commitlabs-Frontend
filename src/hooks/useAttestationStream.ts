import { useEffect, useRef, useCallback } from 'react'
import type { Attestation } from '@/components/RecentAttestationsPanel/RecentAttestationsPanel'

export interface AttestationStreamEvent {
  type: 'attestation'
  data: Attestation
}

export interface UseAttestationStreamOptions {
  commitmentId: string | null
  onAttestation: (attestation: Attestation) => void
  enabled?: boolean
}

const INITIAL_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 30000
const BACKOFF_MULTIPLIER = 2

/**
 * Hook that subscribes to the SSE events route for a commitment and calls
 * `onAttestation` whenever a new attestation event arrives.
 *
 * Implements exponential back-off reconnect and tears down the EventSource
 * on unmount or when `enabled` becomes false.
 */
export function useAttestationStream({
  commitmentId,
  onAttestation,
  enabled = true,
}: UseAttestationStreamOptions): void {
  const onAttestationRef = useRef(onAttestation)
  onAttestationRef.current = onAttestation

  const backoffRef = useRef(INITIAL_BACKOFF_MS)
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current || !commitmentId) return

    cleanup()

    let es: EventSource
    try {
      es = new EventSource(`/api/commitments/${commitmentId}/events`)
    } catch {
      // EventSource not supported — fall back silently
      return
    }

    esRef.current = es
    backoffRef.current = INITIAL_BACKOFF_MS

    es.addEventListener('attestation', (e: MessageEvent) => {
      if (!mountedRef.current) return
      try {
        const attestation = JSON.parse(e.data) as Attestation
        onAttestationRef.current(attestation)
      } catch {
        // Malformed event — ignore
      }
    })

    es.onerror = () => {
      if (!mountedRef.current) return
      cleanup()
      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS)
      backoffRef.current = Math.min(backoffRef.current * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS)
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, delay)
    }
  }, [commitmentId, cleanup])

  useEffect(() => {
    mountedRef.current = true

    if (enabled && commitmentId && typeof EventSource !== 'undefined') {
      connect()
    }

    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [commitmentId, enabled, connect, cleanup])
}
