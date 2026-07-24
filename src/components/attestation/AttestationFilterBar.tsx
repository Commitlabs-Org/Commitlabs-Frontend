'use client'

import { useState } from 'react'
import { ATTESTATION_TYPES, type AttestationType, type AttestationSeverity } from '@/lib/types/domain'

export interface AttestationFilterBarProps {
  attestations: Array<{
    id: string
    severity?: AttestationSeverity
    attestationType?: AttestationType
  }>
  onFilterChange: (filters: {
    severity: AttestationSeverity | 'all'
    type: AttestationType | 'all'
  }) => void
}

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'violation', label: 'Violation' },
] as const

const TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  ...ATTESTATION_TYPES.map((type) => ({
    value: type,
    label: type.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  })),
] as const

export default function AttestationFilterBar({
  attestations,
  onFilterChange,
}: AttestationFilterBarProps) {
  const [severityFilter, setSeverityFilter] = useState<AttestationSeverity | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<AttestationType | 'all'>('all')

  // Calculate counts for each severity
  const severityCounts = {
    all: attestations.length,
    ok: attestations.filter((a) => a.severity === 'ok').length,
    warning: attestations.filter((a) => a.severity === 'warning').length,
    violation: attestations.filter((a) => a.severity === 'violation').length,
  }

  // Calculate counts for each type
  const typeCounts: Record<string, number> = {
    all: attestations.length,
    ...ATTESTATION_TYPES.reduce(
      (acc, type) => ({
        ...acc,
        [type]: attestations.filter((a) => a.attestationType === type).length,
      }),
      {} as Record<string, number>,
    ),
  }

  const handleSeverityChange = (value: AttestationSeverity | 'all') => {
    setSeverityFilter(value)
    onFilterChange({ severity: value, type: typeFilter })
  }

  const handleTypeChange = (value: AttestationType | 'all') => {
    setTypeFilter(value)
    onFilterChange({ severity: severityFilter, type: value })
  }

  return (
    <div className="flex flex-col gap-4 border-b border-gray-200 pb-4">
      {/* Severity Tabs */}
      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Filter attestations by severity"
      >
        {SEVERITY_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={severityFilter === option.value}
            aria-controls="attestation-list"
            onClick={() => handleSeverityChange(option.value)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${
                severityFilter === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }
            `}
          >
            {option.label}
            <span className="ml-2 opacity-75">
              ({severityCounts[option.value as keyof typeof severityCounts]})
            </span>
          </button>
        ))}
      </div>

      {/* Type Filter */}
      <div className="flex items-center gap-2">
        <label htmlFor="type-filter" className="text-sm font-medium text-gray-700">
          Type:
        </label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value as AttestationType | 'all')}
          className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({typeCounts[option.value]})
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
