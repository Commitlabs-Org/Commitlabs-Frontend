// @vitest-environment happy-dom

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AttestationFilterBar from './AttestationFilterBar'
import { type AttestationSeverity, type AttestationType } from '@/lib/types/domain'

describe('AttestationFilterBar', () => {
  const mockAttestations = [
    {
      id: '1',
      severity: 'ok' as AttestationSeverity,
      attestationType: 'health_check' as AttestationType,
    },
    {
      id: '2',
      severity: 'warning' as AttestationSeverity,
      attestationType: 'health_check' as AttestationType,
    },
    {
      id: '3',
      severity: 'violation' as AttestationSeverity,
      attestationType: 'violation' as AttestationType,
    },
    {
      id: '4',
      severity: 'ok' as AttestationSeverity,
      attestationType: 'fee_generation' as AttestationType,
    },
    {
      id: '5',
      severity: 'warning' as AttestationSeverity,
      attestationType: 'drawdown' as AttestationType,
    },
  ]

  const onFilterChange = vi.fn()

  beforeEach(() => {
    onFilterChange.mockClear()
  })

  it('renders severity tabs with correct counts', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    expect(screen.getByRole('tablist', { name: 'Filter attestations by severity' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /All \(5\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Info \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Warning \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Violation \(1\)/i })).toBeInTheDocument()
  })

  it('renders type filter dropdown with correct counts', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const typeFilter = screen.getByLabelText('Type:')
    expect(typeFilter).toBeInTheDocument()

    // Check that all types are present in the select
    expect(screen.getByRole('option', { name: /All Types \(5\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Health Check \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Violation \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Fee Generation \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Drawdown \(1\)/i })).toBeInTheDocument()
  })

  it('selects "All" severity tab by default', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const allTab = screen.getByRole('tab', { name: /All \(5\)/i, selected: true })
    expect(allTab).toBeInTheDocument()
    expect(allTab).toHaveAttribute('aria-selected', 'true')
  })

  it('calls onFilterChange when severity tab is clicked', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const warningTab = screen.getByRole('tab', { name: /Warning \(2\)/i })
    fireEvent.click(warningTab)

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange).toHaveBeenCalledWith({
      severity: 'warning',
      type: 'all',
    })
  })

  it('calls onFilterChange when type filter is changed', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const typeFilter = screen.getByLabelText('Type:')
    fireEvent.change(typeFilter, { target: { value: 'health_check' } })

    expect(onFilterChange).toHaveBeenCalledTimes(1)
    expect(onFilterChange).toHaveBeenCalledWith({
      severity: 'all',
      type: 'health_check',
    })
  })

  it('updates aria-selected when severity tab changes', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const allTab = screen.getByRole('tab', { name: /All \(5\)/i })
    const violationTab = screen.getByRole('tab', { name: /Violation \(1\)/i })

    expect(allTab).toHaveAttribute('aria-selected', 'true')
    expect(violationTab).toHaveAttribute('aria-selected', 'false')

    fireEvent.click(violationTab)

    expect(allTab).toHaveAttribute('aria-selected', 'false')
    expect(violationTab).toHaveAttribute('aria-selected', 'true')
  })

  it('handles keyboard navigation for severity tabs', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const allTab = screen.getByRole('tab', { name: /All \(5\)/i })
    allTab.focus()

    // Tab key should move to next tab
    fireEvent.keyDown(allTab, { key: 'ArrowRight' })
    
    const nextTab = screen.getByRole('tab', { name: /Info \(2\)/i })
    expect(nextTab).toHaveFocus()
  })

  it('renders with empty attestations array', () => {
    render(
      <AttestationFilterBar
        attestations={[]}
        onFilterChange={onFilterChange}
      />
    )

    expect(screen.getByRole('tab', { name: /All \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Info \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Warning \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Violation \(0\)/i })).toBeInTheDocument()
  })

  it('handles attestations with undefined severity', () => {
    const attestationsWithUndefined = [
      { id: '1', severity: undefined as AttestationSeverity | undefined, attestationType: 'health_check' as AttestationType },
      { id: '2', severity: 'ok' as AttestationSeverity, attestationType: 'violation' as AttestationType },
    ]

    render(
      <AttestationFilterBar
        attestations={attestationsWithUndefined}
        onFilterChange={onFilterChange}
      />
    )

    expect(screen.getByRole('tab', { name: /All \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Info \(1\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Warning \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Violation \(0\)/i })).toBeInTheDocument()
  })

  it('handles attestations with undefined attestationType', () => {
    const attestationsWithUndefined = [
      { id: '1', severity: 'ok' as AttestationSeverity, attestationType: undefined as AttestationType | undefined },
      { id: '2', severity: 'ok' as AttestationSeverity, attestationType: 'health_check' as AttestationType },
    ]

    render(
      <AttestationFilterBar
        attestations={attestationsWithUndefined}
        onFilterChange={onFilterChange}
      />
    )

    const typeFilter = screen.getByLabelText('Type:')
    expect(typeFilter).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /All Types \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Health Check \(1\)/i })).toBeInTheDocument()
  })

  it('maintains filter state when both severity and type are changed', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const warningTab = screen.getByRole('tab', { name: /Warning \(2\)/i })
    fireEvent.click(warningTab)

    expect(onFilterChange).toHaveBeenCalledWith({
      severity: 'warning',
      type: 'all',
    })

    const typeFilter = screen.getByLabelText('Type:')
    fireEvent.change(typeFilter, { target: { value: 'violation' } })

    expect(onFilterChange).toHaveBeenCalledWith({
      severity: 'warning',
      type: 'violation',
    })
  })

  it('has accessible tablist structure', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const tablist = screen.getByRole('tablist')
    expect(tablist).toHaveAttribute('aria-label', 'Filter attestations by severity')

    const tabs = screen.getAllByRole('tab')
    tabs.forEach((tab: HTMLElement) => {
      expect(tab).toHaveAttribute('aria-controls', 'attestation-list')
    })
  })

  it('handles all-info history (only ok severity)', () => {
    const allInfoAttestations = [
      { id: '1', severity: 'ok' as AttestationSeverity, attestationType: 'health_check' as AttestationType },
      { id: '2', severity: 'ok' as AttestationSeverity, attestationType: 'health_check' as AttestationType },
      { id: '3', severity: 'ok' as AttestationSeverity, attestationType: 'fee_generation' as AttestationType },
    ]

    render(
      <AttestationFilterBar
        attestations={allInfoAttestations}
        onFilterChange={onFilterChange}
      />
    )

    expect(screen.getByRole('tab', { name: /All \(3\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Info \(3\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Warning \(0\)/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Violation \(0\)/i })).toBeInTheDocument()
  })

  it('shows empty state per filter when no attestations match', () => {
    render(
      <AttestationFilterBar
        attestations={mockAttestations}
        onFilterChange={onFilterChange}
      />
    )

    const violationTab = screen.getByRole('tab', { name: /Violation \(1\)/i })
    fireEvent.click(violationTab)

    expect(onFilterChange).toHaveBeenCalledWith({
      severity: 'violation',
      type: 'all',
    })
  })
})
