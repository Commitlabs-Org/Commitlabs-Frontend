// @vitest-environment happy-dom

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOverviewTimeRange, overviewRangeStartDate } from '@/hooks/useOverviewTimeRange';

// ── Helpers ──────────────────────────────────────────────────────────────────

function truncateToStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-15T14:30:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

// ── overviewRangeStartDate (pure function) ───────────────────────────────────

describe('overviewRangeStartDate', () => {
  it('returns null when days is null', () => {
    expect(overviewRangeStartDate(null)).toBeNull();
  });

  it('returns start of today when days is 0', () => {
    const result = overviewRangeStartDate(0)!;
    expect(result).toBeInstanceOf(Date);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
    // 0 days back from "today" (2026-03-15) is still 2026-03-15
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2); // March (0-indexed)
    expect(result.getDate()).toBe(15);
  });

  it('returns correct start-of-day N days in the past', () => {
    const result = overviewRangeStartDate(7)!;
    // 15 - 7 = 8, so 2026-03-08 start of day
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(8);
    expect(result.getHours()).toBe(0);
  });

  it('handles month boundaries correctly', () => {
    // 2026-03-15 minus 20 days = 2026-02-23
    const result = overviewRangeStartDate(20)!;
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(1); // February
    expect(result.getDate()).toBe(23);
  });

  it('handles large day counts', () => {
    const result = overviewRangeStartDate(365)!;
    expect(result.getFullYear()).toBe(2025);
    expect(result.getMonth()).toBe(2); // March
    expect(result.getDate()).toBe(15);
  });

  it('always normalizes to start of day', () => {
    // System time is 14:30:00 — result should be 00:00:00
    const result = overviewRangeStartDate(30)!;
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

// ── sessionStorage round-trip ────────────────────────────────────────────────

describe('useOverviewTimeRange – sessionStorage', () => {
  it('defaults to "30d" when sessionStorage is empty', () => {
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe('30d');
  });

  it('reads a valid persisted range from sessionStorage', () => {
    sessionStorage.setItem('overview.selectedRange', '7d');
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe('7d');
  });

  it('falls back to default when sessionStorage has an invalid key', () => {
    sessionStorage.setItem('overview.selectedRange', 'invalid');
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe('30d');
  });

  it('persists the range to sessionStorage on setRange', () => {
    const { result } = renderHook(() => useOverviewTimeRange());

    act(() => {
      result.current.setRange('90d');
    });

    expect(result.current.selectedRange).toBe('90d');
    expect(sessionStorage.getItem('overview.selectedRange')).toBe('90d');
  });

  it('persists "all" to sessionStorage', () => {
    const { result } = renderHook(() => useOverviewTimeRange());

    act(() => {
      result.current.setRange('all');
    });

    expect(sessionStorage.getItem('overview.selectedRange')).toBe('all');
  });

  it('survives when sessionStorage throws (SSR / private browsing)', () => {
    const originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => {
      throw new Error('SecurityError');
    });

    const { result } = renderHook(() => useOverviewTimeRange());
    // Should not throw, just falls back to default
    expect(result.current.selectedRange).toBe('30d');

    Storage.prototype.getItem = originalGetItem;
  });
});

// ── filterByRange ────────────────────────────────────────────────────────────

describe('useOverviewTimeRange – filterByRange', () => {
  const today = new Date('2026-03-15T14:30:00Z');

  function daysAgo(n: number): string {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString();
  }

  it('returns all items when range is "all" (rangeStart is null)', () => {
    sessionStorage.setItem('overview.selectedRange', 'all');
    const { result } = renderHook(() => useOverviewTimeRange());

    const data = [{ date: daysAgo(0) }, { date: daysAgo(100) }, { date: daysAgo(365) }];

    const filtered = result.current.filterByRange(data, (item) => item.date);
    expect(filtered).toHaveLength(3);
  });

  it('filters items outside the range', () => {
    sessionStorage.setItem('overview.selectedRange', '7d');
    const { result } = renderHook(() => useOverviewTimeRange());

    const data = [
      { date: daysAgo(0) }, // today — in range
      { date: daysAgo(3) }, // 3 days ago — in range
      { date: daysAgo(7) }, // 7 days ago — should be included (inclusive boundary)
      { date: daysAgo(8) }, // 8 days ago — outside range
      { date: daysAgo(30) }, // 30 days ago — outside range
    ];

    const filtered = result.current.filterByRange(data, (item) => item.date);
    expect(filtered).toHaveLength(3);
    expect(filtered.map((d) => d.date)).toEqual([daysAgo(0), daysAgo(3), daysAgo(7)]);
  });

  it('includes items exactly at the rangeStart boundary (inclusive)', () => {
    sessionStorage.setItem('overview.selectedRange', '30d');
    const { result } = renderHook(() => useOverviewTimeRange());

    // 30d range: start = 2026-02-13 00:00:00 UTC
    const rangeStartDate = overviewRangeStartDate(30)!;
    // An item at exactly rangeStart should be included
    const exactBoundary = new Date(rangeStartDate);
    exactBoundary.setHours(0, 0, 0, 0);

    const data = [{ date: exactBoundary.toISOString() }, { date: daysAgo(31) }];

    const filtered = result.current.filterByRange(data, (item) => item.date);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].date).toBe(exactBoundary.toISOString());
  });

  it('handles Date objects as well as ISO strings', () => {
    sessionStorage.setItem('overview.selectedRange', '7d');
    const { result } = renderHook(() => useOverviewTimeRange());

    const data = [{ date: new Date(daysAgo(2)) }, { date: new Date(daysAgo(20)) }];

    const filtered = result.current.filterByRange(data, (item) => item.date);
    expect(filtered).toHaveLength(1);
  });

  it('returns empty array when all items are out of range', () => {
    sessionStorage.setItem('overview.selectedRange', '7d');
    const { result } = renderHook(() => useOverviewTimeRange());

    const data = [{ date: daysAgo(100) }, { date: daysAgo(200) }];

    const filtered = result.current.filterByRange(data, (item) => item.date);
    expect(filtered).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    sessionStorage.setItem('overview.selectedRange', '7d');
    const { result } = renderHook(() => useOverviewTimeRange());
    const filtered = result.current.filterByRange([], (item: { date: string }) => item.date);
    expect(filtered).toHaveLength(0);
  });
});

// ── rangeStart derivation ────────────────────────────────────────────────────

describe('useOverviewTimeRange – rangeStart', () => {
  it('derives rangeStart from the selected option', () => {
    sessionStorage.setItem('overview.selectedRange', '90d');
    const { result } = renderHook(() => useOverviewTimeRange());
    const expected = overviewRangeStartDate(90);
    expect(result.current.rangeStart?.getTime()).toBe(expected?.getTime());
  });

  it('is null when "all" is selected', () => {
    sessionStorage.setItem('overview.selectedRange', 'all');
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.rangeStart).toBeNull();
  });
});
