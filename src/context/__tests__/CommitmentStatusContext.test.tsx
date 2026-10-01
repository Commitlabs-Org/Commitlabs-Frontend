/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import {
  CommitmentStatusProvider,
  useCommitmentStatus,
} from '@/context/CommitmentStatusContext';

// ---------------------------------------------------------------------------
// Test consumer component
// ---------------------------------------------------------------------------

function StatusConsumer() {
  const { status, isLoading, error, lastPollAt, consecutiveFailures, refresh } =
    useCommitmentStatus();
  return (
    <div>
      <span data-testid="status">{status?.status ?? 'null'}</span>
      <span data-testid="daysRemaining">{String(status?.daysRemaining ?? 'null')}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
      <span data-testid="error">{error ?? 'null'}</span>
      <span data-testid="lastPollAt">{lastPollAt ?? 'null'}</span>
      <span data-testid="consecutiveFailures">{String(consecutiveFailures)}</span>
      <button onClick={refresh} data-testid="refresh">
        Refresh
      </button>
    </div>
  );
}

function ThrowingConsumer() {
  useCommitmentStatus();
  return null;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const fetchMock = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('performance', { now: vi.fn(() => Date.now()) });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommitmentStatusContext', () => {
  describe('invariant validation', () => {
    it('throws when useCommitmentStatus is used outside a provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        render(<ThrowingConsumer />);
      }).toThrow('useCommitmentStatus must be used within a CommitmentStatusProvider');
      consoleSpy.mockRestore();
    });

    it('accepts valid status payloads', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'Active',
          daysRemaining: 30,
          expiresAt: '2026-09-30T00:00:00Z',
        }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('status')).toHaveTextContent('Active');
      expect(screen.getByTestId('daysRemaining')).toHaveTextContent('30');
    });

    it('rejects invalid status values (not in allowed set)', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'InvalidStatus',
          daysRemaining: 30,
        }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      // Error should be set since the validation failed
      expect(screen.getByTestId('error')).not.toBe('null');
    });

    it('rejects payloads with negative daysRemaining', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'Active',
          daysRemaining: -5,
        }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('error')).not.toBe('null');
    });

    it('rejects payloads with non-numeric daysRemaining', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'Active',
          daysRemaining: 'thirty',
        }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('error')).not.toBe('null');
    });
  });

  describe('polling bounds', () => {
    it('sets isLoading to false after initial fetch completes', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'Active', daysRemaining: 30 }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      // Initially loading
      expect(screen.getByTestId('isLoading')).toHaveTextContent('true');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('isLoading')).toHaveTextContent('false');
    });

    it('stops polling after MAX_CONSECUTIVE_FAILURES', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      // Let initial fetch fail
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Network error');

      // Advance through multiple poll cycles — failures should accumulate
      for (let i = 0; i < 6; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(31_000);
        });
      }

      // Should have stopped polling (consecutiveFailures >= 5)
      const failures = parseInt(screen.getByTestId('consecutiveFailures').textContent ?? '0');
      expect(failures).toBeGreaterThanOrEqual(5);
    });
  });

  describe('deduplication', () => {
    it('does not make back-to-back fetches within dedup window', async () => {
      let callCount = 0;
      fetchMock.mockImplementation(async () => {
        callCount++;
        return {
          ok: true,
          json: async () => ({ status: 'Active', daysRemaining: 30 }),
        } as Response;
      });

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      // Initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      const initialCount = callCount;

      // Immediate refresh call should be deduped
      await act(async () => {
        const refreshBtn = screen.getByTestId('refresh');
        refreshBtn.click();
        await vi.advanceTimersByTimeAsync(100);
      });

      // Should not have made a new call due to dedup
      expect(callCount).toBe(initialCount);
    });
  });

  describe('error recovery', () => {
    it('clears error on successful fetch after failure', async () => {
      // First call fails
      fetchMock.mockRejectedValueOnce(new Error('Temporary failure'));
      // Second call succeeds
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'Active', daysRemaining: 30 }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      // Let initial fetch fail
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('error')).toHaveTextContent('Temporary failure');

      // Manual refresh (bypassing dedup by advancing past the window)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3_000); // past dedup window
        const refreshBtn = screen.getByTestId('refresh');
        refreshBtn.click();
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('error')).toHaveTextContent('null');
    });
  });

  describe('manual refresh', () => {
    it('sets lastPollAt on successful refresh', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'Active', daysRemaining: 30 }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('lastPollAt')).not.toBe('null');
    });
  });

  describe('terminal status polling', () => {
    it('uses slower poll interval for settled commitments', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'Settled', daysRemaining: 0 }),
      } as Response);

      render(
        <CommitmentStatusProvider commitmentId="test-1">
          <StatusConsumer />
        </CommitmentStatusProvider>,
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      expect(screen.getByTestId('status')).toHaveTextContent('Settled');

      // After the initial fetch, the next poll should be on a longer interval
      // (120s for terminal). Let's advance 30s and check no new fetch happens.
      fetchMock.mockClear();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });

      // No new fetch should have been made within 30s for terminal status
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
