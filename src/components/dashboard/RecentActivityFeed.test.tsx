/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecentActivityFeed } from './RecentActivityFeed';
import { apiGet } from '@/lib/apiClient';
import { Commitment } from '@/lib/types/domain';

vi.mock('@/lib/apiClient', () => ({
  apiGet: vi.fn(),
}));

const mockCommitments: Commitment[] = [
  {
    id: 'CMT-ABC123',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026',
  },
  {
    id: 'CMT-XYZ789',
    type: 'Balanced',
    status: 'Active',
    asset: 'USDC',
    amount: '100,000',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026',
  },
];

const mockedApiGet = vi.mocked(apiGet);

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
  });

  it('renders loading state initially', () => {
    mockedApiGet.mockImplementation(() => new Promise(() => {}));

    render(<RecentActivityFeed commitments={mockCommitments} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders empty state when no commitments', async () => {
    render(<RecentActivityFeed commitments={[]} />);

    await waitFor(() => {
      expect(screen.getByText('No Recent Activity')).toBeInTheDocument();
    });
  });

  it('renders mixed event types correctly', async () => {
    mockedApiGet.mockImplementation((url: string) => {
      if (url.includes('CMT-ABC123')) {
        return Promise.resolve({
          success: true,
          data: {
            events: [
              {
                eventId: 'created:CMT-ABC123',
                kind: 'created',
                occurredAt: new Date(Date.now() - 86400000).toISOString(),
                payload: { asset: 'XLM', amount: '50,000' },
              },
              {
                eventId: 'attestation:ATTR-001',
                kind: 'attestation',
                occurredAt: new Date(Date.now() - 3600000).toISOString(),
                payload: { attestationId: 'ATTR-001', attestationType: 'health_check' },
              },
            ],
          },
        });
      }
      if (url.includes('CMT-XYZ789')) {
        return Promise.resolve({
          success: true,
          data: {
            events: [
              {
                eventId: 'settlement:CMT-XYZ789',
                kind: 'settlement',
                occurredAt: new Date(Date.now() - 7200000).toISOString(),
                payload: { settlementAmount: '105,000' },
              },
            ],
          },
        });
      }
      return Promise.resolve({ success: true, data: { events: [] } });
    });

    render(<RecentActivityFeed commitments={mockCommitments} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Commitment Created')).toBeInTheDocument();
      expect(screen.getByText('Attestation Recorded')).toBeInTheDocument();
      expect(screen.getByText('Settlement Complete')).toBeInTheDocument();
    });
  });

  it('caps feed length and shows view all', async () => {
    const manyEvents = Array.from({ length: 10 }, (_, i) => ({
      eventId: `event-${i}`,
      kind: 'attestation' as const,
      occurredAt: new Date(Date.now() - i * 3600000).toISOString(),
      payload: { attestationId: `ATTR-${i}`, attestationType: 'health_check' },
    }));

    mockedApiGet.mockResolvedValue({
      success: true,
      data: { events: manyEvents },
    });

    render(<RecentActivityFeed commitments={mockCommitments} maxItems={5} />);

    await waitFor(() => {
      expect(screen.getByText('View All Activity')).toBeInTheDocument();
    });
  });

  it('does not show view all when events <= maxItems', async () => {
    const fewEvents = [
      {
        eventId: 'event-1',
        kind: 'created' as const,
        occurredAt: new Date().toISOString(),
        payload: { asset: 'XLM', amount: '50,000' },
      },
    ];

    mockedApiGet.mockResolvedValue({
      success: true,
      data: { events: fewEvents },
    });

    render(<RecentActivityFeed commitments={mockCommitments} maxItems={5} />);

    await waitFor(() => {
      expect(screen.queryByText('View All Activity')).not.toBeInTheDocument();
    });
  });

  it('issues all per-commitment history requests concurrently', async () => {
    const pendingResolvers: Array<(value: unknown) => void> = [];
    mockedApiGet.mockImplementation(
      () =>
        new Promise((resolve) => {
          pendingResolvers.push(resolve);
        }),
    );

    render(<RecentActivityFeed commitments={mockCommitments} />);

    // Every request must already be in flight before any of them resolves.
    // A sequential loop would only issue the next request after the previous
    // one settled, so both calls being issued here proves parallel issuance.
    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledTimes(mockCommitments.length);
    });

    expect(mockedApiGet).toHaveBeenCalledWith('/api/commitments/CMT-ABC123/history');
    expect(mockedApiGet).toHaveBeenCalledWith('/api/commitments/CMT-XYZ789/history');

    // Resolve all pending requests so loading finishes and the feed renders.
    pendingResolvers.forEach((resolve) => resolve({ success: true, data: { events: [] } }));

    await waitFor(() => {
      expect(screen.getByText('No Recent Activity')).toBeInTheDocument();
    });
  });

  it('still renders events from other commitments when one request fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockedApiGet.mockImplementation((url: string) => {
        if (url.includes('CMT-ABC123')) {
          return Promise.reject(new Error('network down'));
        }
        return Promise.resolve({
          success: true,
          data: {
            events: [
              {
                eventId: 'settlement:CMT-XYZ789',
                kind: 'settlement',
                occurredAt: new Date().toISOString(),
                payload: { settlementAmount: '105,000' },
              },
            ],
          },
        });
      });

      render(<RecentActivityFeed commitments={mockCommitments} />);

      await waitFor(() => {
        expect(screen.getByText('Settlement Complete')).toBeInTheDocument();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load history for CMT-ABC123',
        expect.any(Error),
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
