import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately before the delay elapses', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));

    expect(result.current).toBe('hello');
  });

  it('updates the debounced value only after the specified delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }: { value: string; delay: number }) =>
        useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 300 } },
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 300 });

    // Before the delay elapses the debounced value is still stale.
    expect(result.current).toBe('initial');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('updated');
  });

  it('coalesces rapid successive updates to the final value', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'first' } },
    );

    rerender({ value: 'second' });
    rerender({ value: 'third' });
    rerender({ value: 'final' });

    // No timer has fired yet — value should remain 'first'.
    expect(result.current).toBe('first');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Only the last value should be reflected.
    expect(result.current).toBe('final');
  });

  it('does not update the debounced value after unmount (cleanup clears the timer)', () => {
    const { result, unmount, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: 'before' } },
    );

    rerender({ value: 'after' });

    // Unmount before the timer fires.
    unmount();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // The hook has been unmounted; the last captured value should still be
    // 'before' because the pending timer was cleared on cleanup.
    expect(result.current).toBe('before');
  });

  it('uses a default delay of 300 ms when none is provided', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: number }) => useDebounce(value),
      { initialProps: { value: 0 } },
    );

    rerender({ value: 42 });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(42);
  });

  it('handles a delay of 0 and resolves synchronously within the same tick', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 0),
      { initialProps: { value: 'start' } },
    );

    rerender({ value: 'end' });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current).toBe('end');
  });
});
