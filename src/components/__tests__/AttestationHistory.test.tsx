import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AttestationHistory from '../AttestationHistory'
import {
  type Attestation,
  type AttestationSeverity,
  type AttestationType,
} from '@/lib/types/domain'

const COMMITMENT_ID = 'commitment-1'
const NOW = new Date('2026-06-29T12:00:00Z')

let fetchMock: ReturnType<typeof vi.fn>

function makeAttestation(overrides: Partial<Attestation> = {}): Attestation {
  return {
    id: 'attestation-1',
    commitmentId: COMMITMENT_ID,
    kind: 'health_check' as AttestationType,
    observedAt: '2026-06-29T11:00:00Z',
    title: 'Daily compliance check',
    description: 'Risk controls remain within the configured thresholds.',
    txHash: '0xabcdef123456789012',
    severity: 'ok' as AttestationSeverity,
    ...overrides,
  } as Attestation
}

function mockAttestationResponse(attestations: Attestation[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ attestations }),
  })
}

async function findTimelineItems() {
  const list = await screen.findByRole('list')
  return within(list).findAllByRole('listitem')
}

function getTimelineTitles(items: HTMLElement[]) {
  return items.map((item) => within(item).getByRole('heading', { level: 4 }).textContent)
}

function getComplianceSummary() {
  const heading = screen.getByRole('heading', { name: 'Compliance Trend Summary' })
  const summary = heading.closest('div')

  if (!summary) {
    throw new Error('Compliance summary container was not rendered')
  }

  return summary
}

describe('AttestationHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(NOW)
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the empty state and zero-count compliance trend for an empty matching series', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'other-commitment-attestation',
        commitmentId: 'other-commitment',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(await screen.findByText('No attestations match the current filters.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Attestation History' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /All\s*\(0\)/i })).toBeInTheDocument()

    const summary = getComplianceSummary()
    expect(summary).toHaveTextContent(/0\s*Total/)
    expect(summary).toHaveTextContent(/0\s*Info/)
    expect(summary).toHaveTextContent(/0\s*Warnings/)
    expect(summary).toHaveTextContent(/0\s*Violations/)
  })

  it('treats a response without an attestations array as an empty series', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(await screen.findByText('No attestations match the current filters.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /All\s*\(0\)/i })).toBeInTheDocument()
  })

  it('renders a populated timeline with details, transaction text, and compliance trend counts', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-ok',
        title: 'Healthy reserve check',
        severity: 'ok',
        details: { complianceScore: 98 },
      }),
      makeAttestation({
        id: 'attestation-warning',
        title: 'Drawdown warning',
        kind: 'drawdown',
        severity: 'warning',
        observedAt: '2026-06-29T10:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-violation',
        title: 'Limit violation',
        kind: 'violation',
        severity: 'violation',
        observedAt: '2026-06-29T09:00:00Z',
      }),
      makeAttestation({
        id: 'other-commitment',
        commitmentId: 'commitment-2',
        severity: 'violation',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    const items = await findTimelineItems()
    expect(items).toHaveLength(3)
    expect(getTimelineTitles(items)).toEqual([
      'Healthy reserve check',
      'Drawdown warning',
      'Limit violation',
    ])
    expect(screen.getAllByText('TX: 0xabcd...789012')).toHaveLength(3)
    expect(screen.getByText('View details')).toBeInTheDocument()

    const summary = getComplianceSummary()
    expect(summary).toHaveTextContent(/3\s*Total/)
    expect(summary).toHaveTextContent(/1\s*Info/)
    expect(summary).toHaveTextContent(/1\s*Warnings/)
    expect(summary).toHaveTextContent(/1\s*Violations/)
  })

  it('maps mixed severities to accessible timeline items and their colour classes', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-ok',
        title: 'Healthy reserve check',
        severity: 'ok',
      }),
      makeAttestation({
        id: 'attestation-warning',
        title: 'Warning threshold crossed',
        severity: 'warning',
      }),
      makeAttestation({
        id: 'attestation-violation',
        title: 'Violation recorded',
        severity: 'violation',
      }),
      makeAttestation({
        id: 'attestation-unclassified',
        title: 'Unclassified attestation',
        severity: undefined,
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(
      await screen.findByRole('listitem', { name: /Healthy reserve check ok severity/i }),
    ).toHaveClass('border-green-500', 'bg-green-50')
    expect(screen.getByRole('listitem', { name: /Warning threshold crossed warning severity/i })).toHaveClass(
      'border-yellow-500',
      'bg-yellow-50',
    )
    expect(screen.getByRole('listitem', { name: /Violation recorded violation severity/i })).toHaveClass(
      'border-red-500',
      'bg-red-50',
    )
    expect(screen.getByRole('listitem', { name: /Unclassified attestation unknown severity/i })).toHaveClass(
      'border-gray-300',
      'bg-gray-50',
    )
  })

  it('sorts unsorted input newest first and places missing or invalid timestamps last', async () => {
    const missingTimestamp = makeAttestation({
      id: 'attestation-missing-timestamp',
      title: 'Missing timestamp',
      severity: 'warning',
    })
    delete (missingTimestamp as Partial<Attestation>).observedAt

    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-oldest',
        title: 'Oldest attestation',
        observedAt: '2026-06-26T12:00:00Z',
      }),
      missingTimestamp,
      makeAttestation({
        id: 'attestation-newest',
        title: 'Newest attestation',
        observedAt: '2026-06-29T11:59:30Z',
      }),
      makeAttestation({
        id: 'attestation-invalid-timestamp',
        title: 'Invalid timestamp',
        observedAt: 'not-a-date',
      }),
      makeAttestation({
        id: 'attestation-middle',
        title: 'Middle attestation',
        observedAt: '2026-06-28T12:00:00Z',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    const items = await findTimelineItems()
    expect(getTimelineTitles(items)).toEqual([
      'Newest attestation',
      'Middle attestation',
      'Oldest attestation',
      'Invalid timestamp',
      'Missing timestamp',
    ])
    expect(screen.getAllByText('Timestamp unavailable')).toHaveLength(2)
  })

  it('falls back to attestation kind or a generic title when title is missing', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-kind-fallback',
        title: undefined,
        kind: 'fee_generation',
      }),
      makeAttestation({
        id: 'attestation-generic-fallback',
        title: undefined,
        kind: undefined,
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(
      await screen.findByRole('listitem', { name: /fee_generation ok severity/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole('listitem', { name: /Attestation ok severity/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'fee_generation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Attestation' })).toBeInTheDocument()
  })

  it('renders a single attestation without losing singular trend or timestamp wording', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'single-attestation',
        title: 'Single attestation',
        observedAt: '2026-06-29T11:00:00Z',
        txHash: '0x123',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    const items = await findTimelineItems()
    expect(items).toHaveLength(1)
    expect(screen.getByText('1 hour ago')).toBeInTheDocument()
    expect(screen.getByText('TX: 0x123')).toBeInTheDocument()

    const summary = getComplianceSummary()
    expect(summary).toHaveTextContent(/1\s*Total/)
    expect(summary).toHaveTextContent(/1\s*Info/)
    expect(summary).toHaveTextContent(/0\s*Warnings/)
    expect(summary).toHaveTextContent(/0\s*Violations/)
  })

  it('filters the timeline by severity and type without changing the source trend counts', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-ok',
        title: 'Healthy reserve check',
        kind: 'health_check',
        severity: 'ok',
      }),
      makeAttestation({
        id: 'attestation-warning',
        title: 'Drawdown warning',
        kind: 'drawdown',
        severity: 'warning',
      }),
      makeAttestation({
        id: 'attestation-violation',
        title: 'Violation recorded',
        kind: 'violation',
        severity: 'violation',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)
    await screen.findByText('Healthy reserve check')

    fireEvent.click(screen.getByRole('tab', { name: /Warning\s*\(1\)/i }))
    expect(screen.getByRole('listitem', { name: /Drawdown warning warning severity/i })).toBeInTheDocument()
    expect(screen.queryByRole('listitem', { name: /Healthy reserve check ok severity/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Type:'), { target: { value: 'violation' } })
    expect(screen.getByText('No attestations match the current filters.')).toBeInTheDocument()

    const summary = getComplianceSummary()
    expect(summary).toHaveTextContent(/3\s*Total/)
    expect(summary).toHaveTextContent(/1\s*Info/)
    expect(summary).toHaveTextContent(/1\s*Warnings/)
    expect(summary).toHaveTextContent(/1\s*Violations/)
  })

  it('formats timeline timestamps across relative time ranges and safe fallbacks', async () => {
    mockAttestationResponse([
      makeAttestation({
        id: 'attestation-now',
        title: 'Recent attestation',
        observedAt: '2026-06-29T11:59:30Z',
      }),
      makeAttestation({
        id: 'attestation-one-minute',
        title: 'One minute attestation',
        observedAt: '2026-06-29T11:59:00Z',
      }),
      makeAttestation({
        id: 'attestation-minutes',
        title: 'Minutes attestation',
        observedAt: '2026-06-29T11:58:00Z',
      }),
      makeAttestation({
        id: 'attestation-hours',
        title: 'Hours attestation',
        observedAt: '2026-06-29T10:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-day',
        title: 'One day attestation',
        observedAt: '2026-06-28T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-days',
        title: 'Days attestation',
        observedAt: '2026-06-27T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-week',
        title: 'One week attestation',
        observedAt: '2026-06-21T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-weeks',
        title: 'Weeks attestation',
        observedAt: '2026-06-15T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-month',
        title: 'One month attestation',
        observedAt: '2026-05-29T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-months',
        title: 'Months attestation',
        observedAt: '2026-04-25T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-year',
        title: 'One year attestation',
        observedAt: '2025-06-24T12:00:00Z',
      }),
      makeAttestation({
        id: 'attestation-years',
        title: 'Years attestation',
        observedAt: '2024-04-20T12:00:00Z',
      }),
    ])

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(await screen.findByText('just now')).toBeInTheDocument()
    expect(screen.getByText('1 minute ago')).toBeInTheDocument()
    expect(screen.getByText('2 minutes ago')).toBeInTheDocument()
    expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    expect(screen.getByText('1 day ago')).toBeInTheDocument()
    expect(screen.getByText('2 days ago')).toBeInTheDocument()
    expect(screen.getByText('1 week ago')).toBeInTheDocument()
    expect(screen.getByText('2 weeks ago')).toBeInTheDocument()
    expect(screen.getByText('1 month ago')).toBeInTheDocument()
    expect(screen.getByText('2 months ago')).toBeInTheDocument()
    expect(screen.getByText('1 year ago')).toBeInTheDocument()
    expect(screen.getByText('2 years ago')).toBeInTheDocument()
  })

  it('renders the fetch error state', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(await screen.findByText('Error loading attestations: Failed to fetch attestations')).toBeInTheDocument()
  })

  it('renders an unknown error message for non-Error failures', async () => {
    fetchMock.mockRejectedValue('network unavailable')

    render(<AttestationHistory commitmentId={COMMITMENT_ID} />)

    expect(await screen.findByText('Error loading attestations: Unknown error')).toBeInTheDocument()
  })
})
