// @vitest-environment happy-dom

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CommitmentStatusProvider, useCommitmentStatus } from '../CommitmentStatusContext';

const originalFetch = global.fetch;

describe('CommitmentStatusContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              commitmentId: '1',
              status: 'Active',
              daysRemaining: 30,
              complianceScore: 98,
              currentValue: '52,600',
              violationCount: 0,
              expiresAt: '2026-02-09T00:00:00Z',
            },
          }),
      })
    ) as any;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  it('provides initial state and fetches status on mount', async () => {
    function TestComponent() {
      const { status, isLoading } = useCommitmentStatus();
      return (
        <div>
          <div data-testid="loading">{isLoading ? 'Loading' : 'Loaded'}</div>
          {status && (
            <div data-testid="status">{status.status}</div>
          )}
        </div>
      );
    }

    render(
      <CommitmentStatusProvider commitmentId="1">
        <TestComponent />
      </CommitmentStatusProvider>
    );

    expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('Loaded'));
    expect(screen.getByTestId('status')).toHaveTextContent('Active');
  });

  it('pauses polling when tab is hidden', async () => {
    function TestComponent() {
      const { status } = useCommitmentStatus();
      return <div data-testid="status">{status?.status}</div>;
    }

    render(
      <CommitmentStatusProvider commitmentId="1" pollIntervalMs={1000}>
        <TestComponent />
      </CommitmentStatusProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    fireEvent(document, new Event('visibilitychange', { bubbles: true }));
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });

    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1)); // should NOT have been called again

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    fireEvent(document, new Event('visibilitychange', { bubbles: true }));
    vi.advanceTimersByTime(1000);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2)); // should be called again now
  });

  it('handles fetch errors', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network error'))) as any;

    function TestComponent() {
      const { error, isLoading } = useCommitmentStatus();
      return (
        <div>
          {isLoading && <div data-testid="loading">Loading</div>}
          {error && <div data-testid="error">{error}</div>}
        </div>
      );
    }

    render(
      <CommitmentStatusProvider commitmentId="1">
        <TestComponent />
      </CommitmentStatusProvider>
    );

    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('Network error'));
  });

  it('refreshes status when refreshStatus is called', async () => {
    function TestComponent() {
      const { refreshStatus } = useCommitmentStatus();
      return (
        <button data-testid="refresh" onClick={refreshStatus}>Refresh</button>
      );
    }

    render(
      <CommitmentStatusProvider commitmentId="1">
        <TestComponent />
      </CommitmentStatusProvider>
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByTestId('refresh'));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });
});
