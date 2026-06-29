import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ExitTimingPreview } from './ExitTimingPreview';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ExitTimingPreview', () => {
  const defaultProps = {
    commitmentId: '123',
    originalAmount: 50000,
    currentPenaltyPercent: 3,
    maturityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
  };

  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          penaltyAmount: 1500,
          netRefund: 48500,
        },
      }),
    });
  });

  it('renders correctly and fetches initial preview', async () => {
    render(<ExitTimingPreview {...defaultProps} />);
    
    expect(screen.getByText('Exit Timing Preview')).toBeInTheDocument();
    
    // Check if fetch was called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/commitments/123/early-exit/preview');
    });

    // Verify initial state shows current penalty
    await waitFor(() => {
      // 1500 * (30/30) = 1500
      expect(screen.getByText('-1,500.00')).toBeInTheDocument();
      expect(screen.getByText('48,500.00')).toBeInTheDocument();
    });
  });

  it('updates projected penalty when slider changes', async () => {
    render(<ExitTimingPreview {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('-1,500.00')).toBeInTheDocument();
    });

    const slider = screen.getByRole('slider');
    
    // Scrub to 15 days from now (halfway to maturity)
    fireEvent.change(slider, { target: { value: '15' } });
    
    // Wait for debounce and recalculation (penalty should be ~750)
    await waitFor(() => {
      expect(screen.getByText('-750.00')).toBeInTheDocument();
      expect(screen.getByText('49,250.00')).toBeInTheDocument();
    });
  });

  it('shows 0 penalty at maturity', async () => {
    render(<ExitTimingPreview {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('-1,500.00')).toBeInTheDocument();
    });

    const slider = screen.getByRole('slider');
    
    // Scrub to 30 days (maturity)
    fireEvent.change(slider, { target: { value: '30' } });
    
    await waitFor(() => {
      expect(screen.getByText('-0.00')).toBeInTheDocument();
      expect(screen.getByText('50,000.00')).toBeInTheDocument();
    });
  });

  it('handles preview API error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('API error'));
    
    render(<ExitTimingPreview {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch live preview. Using estimates.')).toBeInTheDocument();
      // Should fallback to calculating from props (50000 * 3% = 1500)
      expect(screen.getByText('-1,500.00')).toBeInTheDocument();
    });
  });
});
