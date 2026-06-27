// @vitest-environment happy-dom

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import RecentAttestationsPanel, { Attestation } from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';

vi.mock('@/components/RecentAttestationsPanel/RecentAttestationsPanel.module.css', () => ({
  default: new Proxy({}, { get: (_target, key) => String(key) }),
}));

describe('RecentAttestationsPanel', () => {
  const fixedNow = new Date('2025-01-01T12:00:00.000Z');

  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const SUMMARY = {
    complianceCount: 3,
    warningCount: 2,
    violationCount: 1,
  };

  const attestations: Attestation[] = [
    {
      id: 'ok-1',
      title: 'All checks passed',
      description: 'This attestation is fully compliant.',
      txHash: '0123456789abcdef0123456789abcdef',
      timestamp: '2025-01-01T11:59:00.000Z',
      severity: 'ok',
    },
    {
      id: 'warning-1',
      title: 'Minor issue detected',
      description: 'Review the warning for best practices.',
      txHash: 'abcdef0123456789abcdef0123456789',
      timestamp: new Date('2025-01-01T09:00:00.000Z'),
      severity: 'warning',
    },
    {
      id: 'violation-1',
      title: 'Critical violation found',
      description: 'Immediate attention required.',
      txHash: 'fedcba9876543210fedcba9876543210',
      timestamp: '2024-12-30T12:00:00.000Z',
      severity: 'violation',
    },
  ];

  it('renders the main panel and summary counts', () => {
    render(
      <RecentAttestationsPanel
        attestations={attestations}
        summary={SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />
    );

    expect(screen.getByRole('list', { name: 'Recent Attestations' })).toBeInTheDocument();
    expect(screen.getByText('Compliance')).toBeInTheDocument();
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('Violations')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders a populated attestation list in the provided order with formatted relative timestamps', () => {
    render(
      <RecentAttestationsPanel
        attestations={attestations}
        summary={SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />
    );

    const rows = screen.getAllByRole('button', { name: /attestation:/i });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveAccessibleName('ok attestation: All checks passed');
    expect(rows[1]).toHaveAccessibleName('warning attestation: Minor issue detected');
    expect(rows[2]).toHaveAccessibleName('violation attestation: Critical violation found');

    expect(within(rows[0]).getByText('1 minute ago')).toBeInTheDocument();
    expect(within(rows[1]).getByText('3 hours ago')).toBeInTheDocument();
    expect(within(rows[2]).getByText('2 days ago')).toBeInTheDocument();

    expect(within(rows[0]).getByText('TX: 012345...89abcdef')).toBeInTheDocument();
    expect(within(rows[1]).getByText('TX: abcdef...0123456789')).toBeInTheDocument();
    expect(within(rows[2]).getByText('TX: fedcba...9876543210')).toBeInTheDocument();
  });

  it('applies severity-specific styling classes for each attestation', () => {
    render(
      <RecentAttestationsPanel
        attestations={attestations}
        summary={SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />
    );

    const okRow = screen.getByRole('button', { name: 'ok attestation: All checks passed' });
    const warningRow = screen.getByRole('button', { name: 'warning attestation: Minor issue detected' });
    const violationRow = screen.getByRole('button', { name: 'violation attestation: Critical violation found' });

    expect(okRow.className).toContain('ok');
    expect(warningRow.className).toContain('warning');
    expect(violationRow.className).toContain('violation');
  });

  it('conveys severity using accessible aria-label text, not color alone', () => {
    render(
      <RecentAttestationsPanel
        attestations={attestations}
        summary={SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />
    );

    const okRow = screen.getByRole('button', { name: /ok attestation:/i });
    const warningRow = screen.getByRole('button', { name: /warning attestation:/i });
    const violationRow = screen.getByRole('button', { name: /violation attestation:/i });

    expect(okRow).toBeInTheDocument();
    expect(warningRow).toBeInTheDocument();
    expect(violationRow).toBeInTheDocument();
  });

  it('invokes callbacks for row selection and view all', () => {
    const onSelectAttestation = vi.fn();
    const onViewAll = vi.fn();

    render(
      <RecentAttestationsPanel
        attestations={attestations}
        summary={SUMMARY}
        onSelectAttestation={onSelectAttestation}
        onViewAll={onViewAll}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'warning attestation: Minor issue detected' }));
    fireEvent.click(screen.getByRole('button', { name: 'View all attestations' }));

    expect(onSelectAttestation).toHaveBeenCalledWith('warning-1');
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it('renders a clear empty state when there are no attestations', () => {
    render(
      <RecentAttestationsPanel
        attestations={[]}
        summary={SUMMARY}
        onSelectAttestation={vi.fn()}
        onViewAll={vi.fn()}
      />
    );

    expect(screen.getByText('No attestations available')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /attestation:/i })).toBeNull();
  });
});
