// @vitest-environment happy-dom

import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTestNotification } from '../useTestNotification';

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

// Speed up the simulated delay
vi.mock('node:timers', () => ({}));

describe('useTestNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSuccess.mockClear();
    mockError.mockClear();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with isSending false', () => {
    const { result } = renderHook(() => useTestNotification('email'));
    expect(result.current.isSending).toBe(false);
  });

  it('transitions idle -> sending -> sent and calls success toast', async () => {
    const { result } = renderHook(() => useTestNotification('email'));

    let sendPromise: Promise<void>;
    act(() => {
      sendPromise = result.current.sendTest();
    });

    // isSending is true while the request is in-flight
    expect(result.current.isSending).toBe(true);

    // Advance past the 800 ms simulated delay
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await sendPromise;
    });

    expect(result.current.isSending).toBe(false);
    expect(mockSuccess).toHaveBeenCalledOnce();
    expect(mockSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Sent' }),
    );
    expect(mockError).not.toHaveBeenCalled();
  });

  it('transitions idle -> sending -> error when fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    const { result } = renderHook(() => useTestNotification('slack'));

    await act(async () => {
      const sendPromise = result.current.sendTest();
      vi.advanceTimersByTime(1000);
      await sendPromise;
    });

    expect(result.current.isSending).toBe(false);
    expect(mockError).toHaveBeenCalledOnce();
    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test Failed' }),
    );
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it('ignores a second send while one is already in flight (double-send guard)', async () => {
    const { result } = renderHook(() => useTestNotification('sms'));

    let first: Promise<void>;
    let second: Promise<void>;

    act(() => {
      first = result.current.sendTest();
      second = result.current.sendTest(); // should be a no-op
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await first;
      await second;
    });

    // fetch should only have been called once despite two sendTest invocations
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(mockSuccess).toHaveBeenCalledOnce();
  });

  it('does nothing when channelId is empty', async () => {
    const { result } = renderHook(() => useTestNotification(''));

    await act(async () => {
      await result.current.sendTest();
    });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('tracks two channels independently', async () => {
    const { result: emailHook } = renderHook(() =>
      useTestNotification('email'),
    );
    const { result: slackHook } = renderHook(() =>
      useTestNotification('slack'),
    );

    let p1: Promise<void>;
    let p2: Promise<void>;
    act(() => {
      p1 = emailHook.result.current.sendTest();
      p2 = slackHook.result.current.sendTest();
    });

    expect(emailHook.result.current.isSending).toBe(true);
    expect(slackHook.result.current.isSending).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await p1;
      await p2;
    });

    expect(emailHook.result.current.isSending).toBe(false);
    expect(slackHook.result.current.isSending).toBe(false);
    expect(mockSuccess).toHaveBeenCalledTimes(2);
  });
});
