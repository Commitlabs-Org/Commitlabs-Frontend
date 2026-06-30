/**
 * OverviewTimeRange.test.tsx
 *
 * Tests for the commitments overview time-range filter:
 *  – OverviewTimeRangeSelector component
 *  – useOverviewTimeRange hook
 *  – overviewRangeStartDate utility
 *
 * Run with:  pnpm test
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import OverviewTimeRangeSelector, {
  OVERVIEW_RANGE_OPTIONS,
  type OverviewRangeKey,
} from "@/components/overview/OverviewTimeRangeSelector";
import {
  useOverviewTimeRange,
  overviewRangeStartDate,
} from "@/hooks/useOverviewTimeRange";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// ─── OverviewTimeRangeSelector ────────────────────────────────────────────────

describe("OverviewTimeRangeSelector", () => {
  it("renders all four range options", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="30d" onChange={onChange} />);
    for (const opt of OVERVIEW_RANGE_OPTIONS) {
      expect(screen.getByTestId(`overview-range-btn-${opt.key}`)).toBeTruthy();
    }
  });

  it("marks only the selected option as aria-pressed=true", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="90d" onChange={onChange} />);
    for (const opt of OVERVIEW_RANGE_OPTIONS) {
      const btn = screen.getByTestId(`overview-range-btn-${opt.key}`);
      expect(btn.getAttribute("aria-pressed")).toBe(
        opt.key === "90d" ? "true" : "false"
      );
    }
  });

  it("calls onChange with the correct key when a button is clicked", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="30d" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("overview-range-btn-7d"));
    expect(onChange).toHaveBeenCalledWith("7d");
  });

  it("moves focus and fires onChange on ArrowRight", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="7d" onChange={onChange} />);
    const firstBtn = screen.getByTestId("overview-range-btn-7d");
    fireEvent.keyDown(firstBtn, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("moves focus and fires onChange on ArrowLeft and wraps around", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="7d" onChange={onChange} />);
    const firstBtn = screen.getByTestId("overview-range-btn-7d");
    fireEvent.keyDown(firstBtn, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("all"); // wraps to last
  });

  it("has a group role with an aria-label", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="all" onChange={onChange} />);
    const group = screen.getByRole("group", {
      name: /commitments overview date range/i,
    });
    expect(group).toBeTruthy();
  });

  it("all buttons have type=button to avoid accidental form submission", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="all" onChange={onChange} />);
    for (const opt of OVERVIEW_RANGE_OPTIONS) {
      const btn = screen.getByTestId(`overview-range-btn-${opt.key}`);
      expect(btn.getAttribute("type")).toBe("button");
    }
  });

  it("announces the range change via the live region", () => {
    const onChange = vi.fn();
    render(<OverviewTimeRangeSelector selected="30d" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("overview-range-btn-7d"));
    const announcement = screen.getByTestId("overview-range-announcement");
    expect(announcement.textContent).toMatch(/7 D/i);
  });
});

// ─── useOverviewTimeRange ─────────────────────────────────────────────────────

describe("useOverviewTimeRange", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
      removeItem: (k: string) => { delete store[k]; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to 30d when nothing is stored — default range applied", () => {
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe("30d");
  });

  it("reads a previously persisted range from sessionStorage", () => {
    store["overview.selectedRange"] = "90d";
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe("90d");
  });

  it("setRange updates state and persists to sessionStorage", () => {
    const { result } = renderHook(() => useOverviewTimeRange());
    act(() => { result.current.setRange("all"); });
    expect(result.current.selectedRange).toBe("all");
    expect(store["overview.selectedRange"]).toBe("all");
  });

  it("setRange ignores invalid values stored externally", () => {
    store["overview.selectedRange"] = "invalid-key";
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.selectedRange).toBe("30d");
  });

  describe("filterByRange — range scopes KPIs", () => {
    const allKeys: OverviewRangeKey[] = ["7d", "30d", "90d", "all"];

    it.each(allKeys)("filters correctly for range %s", (key) => {
      store["overview.selectedRange"] = key;
      const { result } = renderHook(() => useOverviewTimeRange());

      const data = [3, 15, 45, 100].map((n) => ({ date: isoDay(n), value: n }));
      const filtered = result.current.filterByRange(data, (p) => p.date);

      const expected: Record<OverviewRangeKey, number> = {
        "7d":  1,
        "30d": 2,
        "90d": 3,
        "all": 4,
      };
      expect(filtered).toHaveLength(expected[key]);
    });

    it("returns an empty array when no data falls within the range — empty range state", () => {
      const { result } = renderHook(() => useOverviewTimeRange());
      act(() => { result.current.setRange("7d"); });
      const data = [40, 50, 60].map((n) => ({ date: isoDay(n), value: n }));
      const filtered = result.current.filterByRange(data, (p) => p.date);
      expect(filtered).toHaveLength(0);
    });

    it("accepts Date objects as well as ISO strings", () => {
      const { result } = renderHook(() => useOverviewTimeRange());
      act(() => { result.current.setRange("7d"); });

      const recent = new Date();
      recent.setDate(recent.getDate() - 3);
      const old = new Date();
      old.setDate(old.getDate() - 20);

      const data = [{ date: recent, value: 1 }, { date: old, value: 2 }];
      const filtered = result.current.filterByRange(data, (p) => p.date);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].value).toBe(1);
    });
  });

  it("rangeStart is null when range is 'all'", () => {
    const { result } = renderHook(() => useOverviewTimeRange());
    act(() => { result.current.setRange("all"); });
    expect(result.current.rangeStart).toBeNull();
  });

  it("rangeStart is a Date when range has a day count", () => {
    const { result } = renderHook(() => useOverviewTimeRange());
    expect(result.current.rangeStart).toBeInstanceOf(Date);
  });
});

// ─── overviewRangeStartDate utility ──────────────────────────────────────────

describe("overviewRangeStartDate", () => {
  it("returns null for days=null (All)", () => {
    expect(overviewRangeStartDate(null)).toBeNull();
  });

  it("returns a date approximately `days` days ago", () => {
    const result = overviewRangeStartDate(7);
    expect(result).toBeInstanceOf(Date);
    const diffMs = Date.now() - result!.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("resets to start of day (00:00:00.000)", () => {
    const result = overviewRangeStartDate(30)!;
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});
