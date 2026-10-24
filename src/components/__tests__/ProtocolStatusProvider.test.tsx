import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import { ProtocolStatusProvider, useProtocolStatus } from '../ProtocolStatusProvider';
import * as statusModule from '@/lib/soroban/protocol-status';

function StatusConsumer() {
  const { status, paused, yieldPool, refresh } = useProtocolStatus();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="paused">{paused ? 'true' : 'false'}</span>
      <span data-testid="yieldPool">{yieldPool.toString()}</span>
      <button data-testid="refresh-btn" onClick={() => void refresh()}>
        Refresh
      </button>
    </div>
  );
}

describe('ProtocolStatusProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Default document.visibilityState to 'visible'
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('polls at 60 s while visible', async () => {
    let callCount = 0;
    const spy = vi.spyOn(statusModule, 'getProtocolStatus').mockImplementation(async () => {
      callCount += 1;
      return {
        status: 'ok',
        paused: false,
        yieldPool: 1000n,
        fetchedAt: Date.now(),
      };
    });

    await act(async () => {
      render(
        <ProtocolStatusProvider>
          <StatusConsumer />
        </ProtocolStatusProvider>
      );
    });

    expect(spy).toHaveBeenCalledTimes(1);

    // Advance 60 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(spy).toHaveBeenCalledTimes(2);

    // Advance another 60 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(spy).toHaveBeenCalledTimes(3);
  });

  it('stops polling when hidden and resumes when visible', async () => {
    const spy = vi.spyOn(statusModule, 'getProtocolStatus').mockImplementation(async () => ({
      status: 'ok',
      paused: false,
      yieldPool: 500n,
      fetchedAt: Date.now(),
    }));

    await act(async () => {
      render(
        <ProtocolStatusProvider>
          <StatusConsumer />
        </ProtocolStatusProvider>
      );
    });

    expect(spy).toHaveBeenCalledTimes(1);

    // Tab becomes hidden
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Advance 60s while hidden - should not poll
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // Tab becomes visible again
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Should refresh immediately when returning to visible
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('refreshes on window focus', async () => {
    const spy = vi.spyOn(statusModule, 'getProtocolStatus').mockImplementation(async () => ({
      status: 'ok',
      paused: false,
      yieldPool: 500n,
      fetchedAt: Date.now(),
    }));

    await act(async () => {
      render(
        <ProtocolStatusProvider>
          <StatusConsumer />
        </ProtocolStatusProvider>
      );
    });

    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent refreshes to one in-flight request', async () => {
    let resolveFirst: (val: any) => void;
    const slowFirstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    let calls = 0;
    const spy = vi.spyOn(statusModule, 'getProtocolStatus').mockImplementation(() => {
      calls += 1;
      return slowFirstPromise as Promise<any>;
    });

    let rendered: any;
    await act(async () => {
      rendered = render(
        <ProtocolStatusProvider>
          <StatusConsumer />
        </ProtocolStatusProvider>
      );
    });

    expect(calls).toBe(1);

    // Trigger multiple concurrent refreshes while the first is in-flight
    const btn = screen.getByTestId('refresh-btn');
    await act(async () => {
      btn.click();
      btn.click();
    });

    // Still only 1 call in-flight
    expect(calls).toBe(1);

    // Complete the in-flight request
    await act(async () => {
      resolveFirst!({
        status: 'ok',
        paused: true,
        yieldPool: 2000n,
        fetchedAt: Date.now(),
      });
    });

    expect(screen.getByTestId('status').textContent).toBe('ok');
    expect(screen.getByTestId('paused').textContent).toBe('true');
    expect(screen.getByTestId('yieldPool').textContent).toBe('2000');
  });
});
