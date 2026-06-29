// @vitest-environment happy-dom

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RecentAttestationsPanel, { type Attestation } from './RecentAttestationsPanel'

// ---------------------------------------------------------------------------
// Minimal EventSource mock
// ---------------------------------------------------------------------------
type EventHandler = (event: MessageEvent) => void

class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  listeners: Record<string, EventHandler[]> = {}
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: EventHandler) {
    if (!this.listeners[type]) this.listeners[type] = []
    this.listeners[type].push(handler)
  }

  /** Helper used in tests to emit a named event */
  emit(type: string, data: unknown) {
    const handlers = this.listeners[type] ?? []
    const event = { data: JSON.stringify(data) } as MessageEvent
    handlers.forEach((h) => h(event))
  }

  close() {
    MockEventSource.instances = MockEventSource.instances.filter((es) => es !== this)
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const baseAttestation: Attestation = {
  id: 'att-1',
  title: 'Health check passed',
  description: 'All systems nominal',
  txHash: '0xabcdef1234567890',
  timestamp: new Date('2025-01-01T00:00:00Z').toISOString(),
  severity: 'ok',
}

const baseSummary = { complianceCount: 1, warningCount: 0, violationCount: 0 }

function renderPanel(overrides: Partial<React.ComponentProps<typeof RecentAttestationsPanel>> = {}) {
  const defaults: React.ComponentProps<typeof RecentAttestationsPanel> = {
    attestations: [baseAttestation],
    summary: baseSummary,
    onSelectAttestation: vi.fn(),
    onViewAll: vi.fn(),
    commitmentId: 'commitment-abc',
    streamingEnabled: true,
  }
  return render(<RecentAttestationsPanel {...defaults} {...overrides} />)
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('RecentAttestationsPanel — real-time streaming', () => {
  it('renders existing attestations without streaming', () => {
    renderPanel({ commitmentId: null })
    expect(screen.getByText('Health check passed')).toBeInTheDocument()
  })

  it('creates an EventSource for the correct commitment URL', () => {
    renderPanel()
    expect(MockEventSource.instances).toHaveLength(1)
    expect(MockEventSource.instances[0].url).toBe('/api/commitments/commitment-abc/events')
  })

  it('does not create an EventSource when streamingEnabled is false', () => {
    renderPanel({ streamingEnabled: false })
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('does not create an EventSource when commitmentId is null', () => {
    renderPanel({ commitmentId: null })
    expect(MockEventSource.instances).toHaveLength(0)
  })

  it('prepends a new attestation live when an event is emitted', async () => {
    renderPanel()
    const newAttestation: Attestation = {
      id: 'att-live-1',
      title: 'Live warning',
      description: 'Something changed',
      txHash: '0xdeadbeef00000000',
      timestamp: new Date().toISOString(),
      severity: 'warning',
    }

    await act(async () => {
      MockEventSource.instances[0].emit('attestation', newAttestation)
    })

    expect(screen.getByText('Live warning')).toBeInTheDocument()
    // New item should appear before the initial one
    const rows = screen.getAllByRole('listitem')
    expect(rows[0]).toHaveAccessibleName(/Live warning/)
    expect(rows[1]).toHaveAccessibleName(/Health check passed/)
  })

  it('deduplicates attestations already present in the initial list', async () => {
    renderPanel()

    await act(async () => {
      // Emit an attestation with the same id as the initial one
      MockEventSource.instances[0].emit('attestation', baseAttestation)
    })

    // Should still only show one item with that title
    expect(screen.getAllByText('Health check passed')).toHaveLength(1)
  })

  it('deduplicates attestations that arrive more than once via SSE', async () => {
    renderPanel({ attestations: [], summary: { complianceCount: 0, warningCount: 0, violationCount: 0 } })
    const newAttestation: Attestation = {
      id: 'att-dup',
      title: 'Duplicate check',
      description: 'Should only appear once',
      txHash: '0x111111',
      timestamp: new Date().toISOString(),
      severity: 'ok',
    }

    await act(async () => {
      MockEventSource.instances[0].emit('attestation', newAttestation)
      MockEventSource.instances[0].emit('attestation', newAttestation)
    })

    expect(screen.getAllByText('Duplicate check')).toHaveLength(1)
  })

  it('announces new attestations via accessible live region', async () => {
    renderPanel()
    const newAttestation: Attestation = {
      id: 'att-announce',
      title: 'Announced attestation',
      description: 'For a11y test',
      txHash: '0xaaaa',
      timestamp: new Date().toISOString(),
      severity: 'ok',
    }

    await act(async () => {
      MockEventSource.instances[0].emit('attestation', newAttestation)
    })

    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toHaveTextContent('New attestation: Announced attestation')
  })

  it('updates summary counts with live attestations', async () => {
    renderPanel()
    const warningAttestation: Attestation = {
      id: 'att-warn',
      title: 'Warning event',
      description: 'Increments warning count',
      txHash: '0xwarn',
      timestamp: new Date().toISOString(),
      severity: 'warning',
    }

    await act(async () => {
      MockEventSource.instances[0].emit('attestation', warningAttestation)
    })

    // Initial warningCount was 0; after streaming it should be 1
    expect(screen.getByLabelText('1 warning attestations')).toBeInTheDocument()
  })

  it('falls back gracefully when EventSource is unavailable', () => {
    vi.stubGlobal('EventSource', undefined)
    expect(() => renderPanel()).not.toThrow()
    expect(screen.getByText('Health check passed')).toBeInTheDocument()
  })

  it('reconnects with backoff on EventSource error', async () => {
    vi.useFakeTimers()
    renderPanel()

    const es = MockEventSource.instances[0]

    await act(async () => {
      es.onerror?.()
    })

    // After backoff delay a new EventSource should be created
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1)
    vi.useRealTimers()
  })
})
