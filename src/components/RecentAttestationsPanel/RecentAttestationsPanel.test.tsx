// @vitest-environment happy-dom

import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RecentAttestationsPanel, { type Attestation } from './RecentAttestationsPanel'

vi.mock('./RecentAttestationsPanel.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}))

const BASE_TIME = new Date('2026-06-23T12:00:00Z')

const summary = {
  complianceCount: 3,
  warningCount: 2,
  violationCount: 1,
}

const attestations: Attestation[] = [
  {
    id: 'attestation-ok',
    title: 'Reserve proof accepted',
    description: 'Oracle attested that reserves stayed within tolerance.',
    txHash: 'abcdef1234567890abcdef1234567890',
    timestamp: new Date('2026-06-23T11:59:30Z'),
    severity: 'ok',
  },
  {
    id: 'attestation-warning',
    title: 'Allocation drift warning',
    description: 'Exposure moved close to the policy limit.',
    txHash: '0123456789abcdef0123456789abcdef',
    timestamp: '2026-06-23T10:00:00Z',
    severity: 'warning',
  },
  {
    id: 'attestation-violation',
    title: 'Compliance breach detected',
    description: 'The commitment crossed the maximum drawdown boundary.',
    txHash: 'fedcba9876543210fedcba9876543210',
    timestamp: '2026-06-20T12:00:00Z',
    severity: 'violation',
  },
]

function renderPanel(overrides: Partial<Parameters<typeof RecentAttestationsPanel>[0]> = {}) {
  const props = {
    attestations,
    summary,
    onSelectAttestation: vi.fn(),
    onViewAll: vi.fn(),
    ...overrides,
  }

  render(<RecentAttestationsPanel {...props} />)

  return props
}

describe('RecentAttestationsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(BASE_TIME)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders an empty state while preserving the summary footer', () => {
    renderPanel({ attestations: [] })

    expect(screen.getByRole('region', { name: 'Recent Attestations' })).toBeInTheDocument()
    expect(screen.getByText('No attestations available')).toBeInTheDocument()
    expect(screen.getByLabelText('3 compliance attestations')).toHaveTextContent('3')
    expect(screen.getByLabelText('2 warning attestations')).toHaveTextContent('2')
    expect(screen.getByLabelText('1 violation attestations')).toHaveTextContent('1')
  })

  it('renders populated attestations in caller-provided order with relative timestamps', () => {
    renderPanel()

    const rows = screen.getAllByRole('listitem').filter((item) =>
      item.getAttribute('aria-label')?.includes('attestation:'),
    )

    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByRole('heading', { name: 'Reserve proof accepted' })).toBeInTheDocument()
    expect(within(rows[1]).getByRole('heading', { name: 'Allocation drift warning' })).toBeInTheDocument()
    expect(within(rows[2]).getByRole('heading', { name: 'Compliance breach detected' })).toBeInTheDocument()
    expect(rows[0]).toHaveTextContent('just now')
    expect(rows[1]).toHaveTextContent('2 hours ago')
    expect(rows[2]).toHaveTextContent('3 days ago')
  })

  it('conveys severity through labels and severity-specific classes', () => {
    renderPanel()

    expect(screen.getByRole('listitem', { name: 'ok attestation: Reserve proof accepted' })).toHaveClass('ok')
    expect(screen.getByRole('listitem', { name: 'warning attestation: Allocation drift warning' })).toHaveClass(
      'warning',
    )
    expect(screen.getByRole('listitem', { name: 'violation attestation: Compliance breach detected' })).toHaveClass(
      'violation',
    )
  })

  it('truncates transaction hashes for compact row density', () => {
    renderPanel()

    expect(screen.getByText('TX: abcdef...567890')).toBeInTheDocument()
    expect(screen.getByText('TX: 012345...abcdef')).toBeInTheDocument()
    expect(screen.getByText('TX: fedcba...543210')).toBeInTheDocument()
  })

  it('fires view-all and row selection callbacks', () => {
    const props = renderPanel()

    fireEvent.click(screen.getByRole('button', { name: 'View all attestations' }))
    fireEvent.click(screen.getByRole('listitem', { name: 'warning attestation: Allocation drift warning' }))

    expect(props.onViewAll).toHaveBeenCalledTimes(1)
    expect(props.onSelectAttestation).toHaveBeenCalledWith('attestation-warning')
  })
})
