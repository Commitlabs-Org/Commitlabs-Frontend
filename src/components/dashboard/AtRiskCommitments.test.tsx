import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AtRiskCommitments } from './AtRiskCommitments';
import { fetchProtocolConstants } from '@/utils/protocol';
import { Commitment } from '@/lib/types/domain';

jest.mock('@/utils/protocol', () => ({
  fetchProtocolConstants: jest.fn()
}));

const mockWarning = jest.fn();
jest.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ warning: mockWarning }),
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
  },
];

describe('AtRiskCommitments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchProtocolConstants as jest.Mock).mockResolvedValue({
      commitmentLimits: { maxLossPercentCeiling: 10 },
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
      expect(screen.getByText('low compliance')).toBeInTheDocument();
      expect(screen.getByText('maturing soon')).toBeInTheDocument();
      expect(screen.getByText('action required')).toBeInTheDocument();
    });
  });

  it('shows configure thresholds button', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => {
      expect(screen.getByText('Configure Thresholds')).toBeInTheDocument();
    });
  });

  it('toggles threshold settings panel', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));

    fireEvent.click(screen.getByText('Configure Thresholds'));
    expect(screen.getByLabelText('At-risk threshold settings')).toBeInTheDocument();
    expect(screen.getByText('Hide Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Hide Settings'));
    expect(screen.queryByLabelText('At-risk threshold settings')).not.toBeInTheDocument();
  });

  it('default thresholds preserve existing behavior', async () => {
    // commitment[0] has compliance 90 (>= 70) and 30 days (> 7) — should be healthy
    render(<AtRiskCommitments commitments={[mockCommitments[0]]} />);
    await waitFor(() => {
      expect(screen.getByText('All Commitments Healthy')).toBeInTheDocument();
    });
  });

  it('threshold change re-filters commitments', async () => {
    render(<AtRiskCommitments commitments={[mockCommitments[0]]} />);
    await waitFor(() => screen.getByText('All Commitments Healthy'));

    fireEvent.click(screen.getByText('Configure Thresholds'));

    const complianceInput = screen.getByLabelText('Compliance score below (0–100)');
    // Raise threshold above commitment[0]'s score of 90 → should now flag it
    fireEvent.change(complianceInput, { target: { value: '95' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });
  });

  it('rejects invalid compliance threshold', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));

    fireEvent.click(screen.getByText('Configure Thresholds'));
    const input = screen.getByLabelText('Compliance score below (0–100)');
    fireEvent.change(input, { target: { value: '150' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Compliance score must be between 0 and 100.'
    );
  });

  it('rejects invalid days threshold', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => screen.getByText('Configure Thresholds'));

    fireEvent.click(screen.getByText('Configure Thresholds'));
    const input = screen.getByLabelText('Days remaining at or below (0–365)');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByText('Apply'));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Days remaining must be between 0 and 365.'
    );
  });

  it('fires toast when a commitment newly enters at-risk', async () => {
    render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });

    expect(mockWarning).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Commitment At Risk' })
    );
  });

  it('does not fire duplicate alerts for already-at-risk commitments', async () => {
    const { rerender } = render(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => screen.getByText('Needs Attention'));
    const firstCallCount = mockWarning.mock.calls.length;

    rerender(<AtRiskCommitments commitments={mockCommitments} />);
    await waitFor(() => screen.getByText('Needs Attention'));

    // No additional warnings for already-known at-risk commitments
    expect(mockWarning.mock.calls.length).toBe(firstCallCount);
  });

  it('calls onThresholdsChange when thresholds are applied', async () => {
    const onThresholdsChange = jest.fn();
    render(
      <AtRiskCommitments
        commitments={mockCommitments}
        onThresholdsChange={onThresholdsChange}
      />
    );
    await waitFor(() => screen.getByText('Configure Thresholds'));

    fireEvent.click(screen.getByText('Configure Thresholds'));
    const input = screen.getByLabelText('Compliance score below (0–100)');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.click(screen.getByText('Apply'));

    await waitFor(() => {
      expect(onThresholdsChange).toHaveBeenCalledWith(
        expect.objectContaining({ complianceScoreThreshold: 80 })
      );
    });
  });
});
