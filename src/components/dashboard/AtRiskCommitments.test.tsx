import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AtRiskCommitments } from './AtRiskCommitments';
import { fetchProtocolConstants } from '@/utils/protocol';
import { Commitment } from '@/lib/types/domain';

jest.mock('@/utils/protocol', () => ({
  fetchProtocolConstants: jest.fn()
}));

const mockCommitments: Commitment[] = [
  {
    id: '1',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '100',
    complianceScore: 90,
    daysRemaining: 30,
  },
  {
    id: '2',
    type: 'Balanced',
    status: 'Violated',
    asset: 'XLM',
    amount: '200',
    complianceScore: 40,
    daysRemaining: 5,
  }
];

describe('AtRiskCommitments', () => {
  beforeEach(() => {
    (fetchProtocolConstants as jest.Mock).mockResolvedValue({
      commitmentLimits: { maxLossPercentCeiling: 10 }
    });
  });

  it('renders loading state initially', () => {
    const { container } = render(<AtRiskCommitments commitments={mockCommitments} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders healthy state when no commitments are at risk', async () => {
    render(<AtRiskCommitments commitments={[mockCommitments[0]]} />);
    
    await waitFor(() => {
      expect(screen.getByText('All Commitments Healthy')).toBeInTheDocument();
    });
  });

  it('renders at risk commitments', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    
    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
      expect(screen.getByText('1 at risk')).toBeInTheDocument();
      // Should show the low compliance and maturing soon categories
      expect(screen.getByText('low compliance')).toBeInTheDocument();
      expect(screen.getByText('maturing soon')).toBeInTheDocument();
      expect(screen.getByText('action required')).toBeInTheDocument();
    });
  });
});
