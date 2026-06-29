import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RecentActivityFeed } from './RecentActivityFeed';
import { apiGet } from '@/lib/apiClient';
import { Commitment } from '@/lib/types/domain';

jest.mock('@/lib/apiClient', () => ({
  apiGet: jest.fn()
}));

const mockCommitments: Commitment[] = [
  {
    id: 'CMT-ABC123',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '50,000',
    createdDate: 'Jan 10, 2026',
    expiryDate: 'Feb 9, 2026'
  },
  {
    id: 'CMT-XYZ789',
    type: 'Balanced',
    status: 'Active',
    asset: 'USDC',
    amount: '100,000',
    createdDate: 'Dec 15, 2025',
    expiryDate: 'Feb 13, 2026'
  }
];

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    (apiGet as jest.Mock).mockReset();
  });

  it('renders loading state initially', () => {
    render(<RecentActivityFeed commitments={mockCommitments} />);
    expect(screen.getByRole('list')).not.toBeInTheDocument();
  });

  it('renders empty state when no commitments', async () => {
    render(<RecentActivityFeed commitments={[]} />);
    
    await waitFor(() => {
      expect(screen.getByText('No Recent Activity')).toBeInTheDocument();
    });
  });

  it('renders mixed event types correctly', async () => {
    (apiGet as jest.Mock).mockImplementation((url: string) => {
      if (url.includes('CMT-ABC123')) {
        return Promise.resolve({
          success: true,
          data: {
            events: [
              {
                eventId: 'created:CMT-ABC123',
                kind: 'created',
                occurredAt: new Date(Date.now() - 86400000).toISOString(),
                payload: { asset: 'XLM', amount: '50,000' }
              },
              {
                eventId: 'attestation:ATTR-001',
                kind: 'attestation',
                occurredAt: new Date(Date.now() - 3600000).toISOString(),
                payload: { attestationId: 'ATTR-001', attestationType: 'health_check' }
              }
            ]
          }
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
                payload: { settlementAmount: '105,000' }
              }
            ]
          }
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
      payload: { attestationId: `ATTR-${i}`, attestationType: 'health_check' }
    }));

    (apiGet as jest.Mock).mockResolvedValue({
      success: true,
      data: { events: manyEvents }
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
        payload: { asset: 'XLM', amount: '50,000' }
      }
    ];

    (apiGet as jest.Mock).mockResolvedValue({
      success: true,
      data: { events: fewEvents }
    });

    render(<RecentActivityFeed commitments={mockCommitments} maxItems={5} />);
    
    await waitFor(() => {
      expect(screen.queryByText('View All Activity')).not.toBeInTheDocument();
    });
  });
});
