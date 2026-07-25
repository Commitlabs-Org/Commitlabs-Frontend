// @vitest-environment happy-dom

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecentAttestationsPanel, { type Attestation } from './RecentAttestationsPanel'
import {
  buildAttestationCsvContent,
  buildAttestationCsvRows,
  buildAttestationExportFilename,
  ATTESTATION_CSV_HEADERS,
} from '@/utils/chartExport'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_SUMMARY = { complianceCount: 1, warningCount: 1, violationCount: 0 }

const ATTESTATIONS: Attestation[] = [
  {
    id: 'a1',
    title: 'Compliance check',
    description: 'All policies met',
    txHash: '0xabc123def456',
    timestamp: '2026-01-01T10:00:00.000Z',
    severity: 'ok',
  },
  {
    id: 'a2',
    title: 'Threshold warning',
    description: 'Near limit',
    txHash: '0x111222333444',
    timestamp: new Date('2026-01-02T12:00:00.000Z'),
    severity: 'warning',
  },
]

// ---------------------------------------------------------------------------
// Unit tests for chartExport attestation helpers
// ---------------------------------------------------------------------------

describe('buildAttestationCsvRows', () => {
  it('maps each attestation to the correct columns', () => {
    const rows = buildAttestationCsvRows(ATTESTATIONS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual(['a1', 'Compliance check', 'All policies met', '0xabc123def456', '2026-01-01T10:00:00.000Z', 'ok'])
    // Date instance should be serialised to ISO string
    expect(rows[1][4]).toBe('2026-01-02T12:00:00.000Z')
  })

  it('returns an empty array for no attestations', () => {
    expect(buildAttestationCsvRows([])).toEqual([])
  })
})

describe('buildAttestationCsvContent', () => {
  it('includes the CSV header row', () => {
    const csv = buildAttestationCsvContent(ATTESTATIONS)
    const headerRow = [...ATTESTATION_CSV_HEADERS].join(',')
    expect(csv).toContain(headerRow)
  })

  it('produces only a header row when attestations are empty', () => {
    const csv = buildAttestationCsvContent([])
    expect(csv).toBe('ID,Title,Description,TX Hash,Timestamp,Severity\r\n')
  })

  it('escapes formula-injection characters in fields', () => {
    const malicious: Attestation[] = [
      {
        id: '=CMD()',
        title: '+formula',
        description: 'safe',
        txHash: '0x000',
        timestamp: '2026-01-01T00:00:00.000Z',
        severity: 'ok',
      },
    ]
    const csv = buildAttestationCsvContent(malicious)
    // escapeCsvField prepends ' to formula-like values
    expect(csv).toContain("'=CMD()")
    expect(csv).toContain("'+formula")
  })

  it('wraps fields containing commas in double-quotes', () => {
    const withComma: Attestation[] = [
      {
        id: 'x',
        title: 'title, with comma',
        description: 'desc',
        txHash: '0x0',
        timestamp: '2026-01-01T00:00:00.000Z',
        severity: 'ok',
      },
    ]
    const csv = buildAttestationCsvContent(withComma)
    expect(csv).toContain('"title, with comma"')
  })
})

describe('buildAttestationExportFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes the sanitized commitment id and date', () => {
    const name = buildAttestationExportFilename('cmt/001')
    expect(name).toBe('attestations-cmt-001-2026-06-29.csv')
  })

  it('falls back to "commitment" when id is empty', () => {
    const name = buildAttestationExportFilename('')
    expect(name).toBe('attestations-commitment-2026-06-29.csv')
  })

  it('strips special characters from the commitment id', () => {
    const name = buildAttestationExportFilename('bad name!!!')
    expect(name).toBe('attestations-bad-name-2026-06-29.csv')
  })
})

// ---------------------------------------------------------------------------
// Component integration tests
// ---------------------------------------------------------------------------

function setupDownloadMocks() {
  Object.defineProperty(window.URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:test'),
  })
  Object.defineProperty(window.URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  })
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
}

describe('RecentAttestationsPanel – Export CSV button', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-29T00:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('renders the Export CSV button', () => {
    render(
      <RecentAttestationsPanel
        attestations={ATTESTATIONS}
        summary={BASE_SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: /export attestations as csv/i })).toBeInTheDocument()
  })

  it('disables the Export CSV button when attestations is empty', () => {
    render(
      <RecentAttestationsPanel
        attestations={[]}
        summary={{ complianceCount: 0, warningCount: 0, violationCount: 0 }}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />,
    )
    const btn = screen.getByRole('button', { name: /export attestations as csv/i })
    expect(btn).toBeDisabled()
  })

  it('is enabled when there are attestations', () => {
    render(
      <RecentAttestationsPanel
        attestations={ATTESTATIONS}
        summary={BASE_SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />,
    )
    const btn = screen.getByRole('button', { name: /export attestations as csv/i })
    expect(btn).not.toBeDisabled()
  })

  it('triggers a CSV download when clicked', async () => {
    const clickSpy = setupDownloadMocks()
    render(
      <RecentAttestationsPanel
        attestations={ATTESTATIONS}
        commitmentId="cmt-42"
        summary={BASE_SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /export attestations as csv/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(window.URL.createObjectURL).toHaveBeenCalled()
  })

  it('reflects only the displayed attestations in the CSV (filtered set)', async () => {
    const clickSpy = setupDownloadMocks()
    // Only pass one attestation to simulate a filtered view
    render(
      <RecentAttestationsPanel
        attestations={[ATTESTATIONS[0]]}
        commitmentId="cmt-42"
        summary={{ complianceCount: 1, warningCount: 0, violationCount: 0 }}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /export attestations as csv/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())

    const blobArg = (window.URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob
    const text = await blobArg.text()
    expect(text).toContain('Compliance check')
    expect(text).not.toContain('Threshold warning')
  })
})
