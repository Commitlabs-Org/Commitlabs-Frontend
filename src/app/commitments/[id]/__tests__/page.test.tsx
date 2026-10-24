import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CommitmentDetailPage from '../page';
import * as readModule from '@/lib/soroban/read';
import {
  formatRelativeTime,
  formatAbsoluteTime,
  shortenAddress,
} from '@/lib/soroban/read';
import { EscrowErrorCode, TxError } from '@/lib/soroban/errors';

vi.mock('@/lib/soroban/read', async () => {
  const actual = await vi.importActual<typeof import('@/lib/soroban/read')>('@/lib/soroban/read');
  return {
    ...actual,
    getCommitment: vi.fn(),
    getAttestations: vi.fn(),
    getDispute: vi.fn(),
  };
});

describe('CommitmentDetailPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ID Validation & Invalid State', () => {
    it('shows validation error without calling RPC for non-numeric ID "abc"', async () => {
      render(<CommitmentDetailPage params={{ id: 'abc' }} />);

      expect(screen.getByText('Invalid Commitment ID')).toBeTruthy();
      expect(screen.getByText(/Commitment ID must be a non-negative integer/i)).toBeTruthy();
      expect(readModule.getCommitment).not.toHaveBeenCalled();
    });

    it('shows validation error without calling RPC for negative ID "-1"', async () => {
      render(<CommitmentDetailPage params={{ id: '-1' }} />);

      expect(screen.getByText('Invalid Commitment ID')).toBeTruthy();
      expect(readModule.getCommitment).not.toHaveBeenCalled();
    });

    it('shows validation error without calling RPC for out-of-range 2^64 ID', async () => {
      render(<CommitmentDetailPage params={{ id: '18446744073709551616' }} />);

      expect(screen.getByText('Invalid Commitment ID')).toBeTruthy();
      expect(screen.getByText(/out of range/i)).toBeTruthy();
      expect(readModule.getCommitment).not.toHaveBeenCalled();
    });
  });

  describe('Not-Found State', () => {
    it('displays Not-Found UI when contract returns NotFound error code 3', async () => {
      const notFoundErr = new TxError('contract', 'The requested commitment could not be found.', {
        code: EscrowErrorCode.NotFound,
      });
      vi.mocked(readModule.getCommitment).mockRejectedValue(notFoundErr);
      vi.mocked(readModule.getAttestations).mockResolvedValue([]);
      vi.mocked(readModule.getDispute).mockResolvedValue(null);

      render(<CommitmentDetailPage params={{ id: '9999' }} />);

      await waitFor(() => {
        expect(screen.getByText('Commitment Not Found')).toBeTruthy();
      });

      expect(screen.getByText(/No on-chain commitment exists with ID/i)).toBeTruthy();
      expect(screen.getByText('#9999')).toBeTruthy();
      expect(screen.getByRole('link', { name: /Return to Dashboard/i })).toBeTruthy();
    });
  });

  describe('Error State & Retry Action', () => {
    it('displays error UI and retries on button click', async () => {
      const user = userEvent.setup();
      vi.mocked(readModule.getCommitment)
        .mockRejectedValueOnce(new Error('Stellar RPC node timed out'))
        .mockResolvedValueOnce({
          id: '12',
          owner: 'GOWNER1111111111111111111111111111111111111111111111111',
          asset: 'CASSET1111111111111111111111111111111111111111111111111',
          amount: 1000000000n,
          accruedYield: 50000000n,
          risk: 'Balanced',
          status: 'Funded',
          maturity: 1735000000n,
          penaltyBps: 300,
          complianceScore: 90,
          createdAt: 1732000000n,
          metadata: {},
        });
      vi.mocked(readModule.getAttestations).mockResolvedValue([]);
      vi.mocked(readModule.getDispute).mockResolvedValue(null);

      render(<CommitmentDetailPage params={{ id: '12' }} />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Commitment')).toBeTruthy();
      });
      expect(screen.getByText('Stellar RPC node timed out')).toBeTruthy();

      const retryBtn = screen.getByRole('button', { name: /Try Again/i });
      await user.click(retryBtn);

      await waitFor(() => {
        expect(screen.getByText('Commitment #12')).toBeTruthy();
      });
      expect(readModule.getCommitment).toHaveBeenCalledTimes(2);
    });
  });

  describe('Loaded State (Full Record with Attestations & Dispute)', () => {
    const mockCommitment: readModule.OnChainCommitment = {
      id: '0',
      owner: 'GOWNER12345678901234567890123456789012345678901234567890',
      asset: 'CASSET12345678901234567890123456789012345678901234567890',
      amount: 5000000000n,
      accruedYield: 250000000n,
      risk: 'Balanced',
      status: 'Funded',
      maturity: 1735689600n,
      penaltyBps: 300,
      complianceScore: 92,
      createdAt: 1733097600n,
      metadata: {
        note: 'Seed escrow investment',
        category: 'DeFi-Vault',
      },
    };

    const mockAttestations: readModule.OnChainAttestation[] = [
      {
        attestor: 'GATTESTOR11111111111111111111111111111111111111111111111',
        complianceScore: 92,
        timestamp: 1733500000n,
      },
    ];

    const mockDispute: readModule.OnChainDispute = {
      reasonCategory: 'Fraud Suspicion',
      reasonCode: 2,
      reasonText: 'Flagged suspicious activity on destination wallet.',
      disputedAt: 1734000000n,
      disputedBy: 'GADMIN1111111111111111111111111111111111111111111111111',
    };

    it('renders commitment terms, compliance score, and timeline', async () => {
      vi.mocked(readModule.getCommitment).mockResolvedValue(mockCommitment);
      vi.mocked(readModule.getAttestations).mockResolvedValue(mockAttestations);
      vi.mocked(readModule.getDispute).mockResolvedValue(null);

      render(<CommitmentDetailPage params={{ id: '0' }} />);

      await waitFor(() => {
        expect(screen.getByText('Commitment #0')).toBeTruthy();
      });

      expect(screen.getByText('5,000,000,000')).toBeTruthy();
      expect(screen.getByText('+250,000,000')).toBeTruthy();
      expect(screen.getAllByText('92 / 100')).toHaveLength(2);
      expect(screen.getByText(/3.00% \(300 basis points\)/i)).toBeTruthy();

      // Attestations section
      expect(screen.getByText('Compliance Attestations')).toBeTruthy();
      expect(screen.getByText('GATTES...111111')).toBeTruthy();

      // Metadata section
      expect(screen.getByText('Commitment Metadata')).toBeTruthy();
      expect(screen.getByText('note')).toBeTruthy();
      expect(screen.getByText('Seed escrow investment')).toBeTruthy();

      // When no dispute, Dispute section should NOT be in the document
      expect(screen.queryByText('Active Dispute')).toBeNull();
    });

    it('renders Dispute section when dispute is Some', async () => {
      vi.mocked(readModule.getCommitment).mockResolvedValue({
        ...mockCommitment,
        status: 'Disputed',
      });
      vi.mocked(readModule.getAttestations).mockResolvedValue([]);
      vi.mocked(readModule.getDispute).mockResolvedValue(mockDispute);

      render(<CommitmentDetailPage params={{ id: '0' }} />);

      await waitFor(() => {
        expect(screen.getByText('Active Dispute')).toBeTruthy();
      });

      expect(screen.getByText('Fraud Suspicion')).toBeTruthy();
      expect(screen.getByText('Flagged suspicious activity on destination wallet.')).toBeTruthy();
      expect(screen.getByText(mockDispute.disputedBy)).toBeTruthy();
      expect(screen.getByText('No compliance attestations recorded yet.')).toBeTruthy();
    });

    it('renders text content safely without injecting HTML', async () => {
      const xssDispute: readModule.OnChainDispute = {
        reasonCategory: 'Other',
        reasonCode: 4,
        reasonText: '<img src=x onerror=alert(1)>',
        disputedAt: 1734000000n,
        disputedBy: 'GADMIN1111111111111111111111111111111111111111111111111',
      };

      vi.mocked(readModule.getCommitment).mockResolvedValue({
        ...mockCommitment,
        metadata: {
          xssPayload: '<script>alert(1)</script>',
        },
      });
      vi.mocked(readModule.getAttestations).mockResolvedValue([]);
      vi.mocked(readModule.getDispute).mockResolvedValue(xssDispute);

      render(<CommitmentDetailPage params={{ id: '0' }} />);

      await waitFor(() => {
        expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
      });
      expect(screen.getByText('<script>alert(1)</script>')).toBeTruthy();
      // Ensure it is rendered as text and no script tags executed
      expect(document.querySelector('script:not([src])')).toBeNull();
    });
  });

  describe('Formatting Utilities', () => {
    it('formats relative time accurately', () => {
      const now = 1700000000000;
      expect(formatRelativeTime(1699999990n, now)).toBe('10s ago');
      expect(formatRelativeTime(1699999800n, now)).toBe('3m ago');
      expect(formatRelativeTime(1699992800n, now)).toBe('2h ago');
      expect(formatRelativeTime(1699740800n, now)).toBe('3d ago');
    });

    it('formats absolute time in UTC', () => {
      expect(formatAbsoluteTime(1700000000n)).toBe('2023-11-14 22:13:20 UTC');
      expect(formatAbsoluteTime(0n)).toBe('Not set');
    });

    it('shortens Stellar addresses', () => {
      expect(shortenAddress('GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF')).toBe(
        'GAAAAA...AAAWHF',
      );
      expect(shortenAddress('SHORT')).toBe('SHORT');
    });
  });
});
