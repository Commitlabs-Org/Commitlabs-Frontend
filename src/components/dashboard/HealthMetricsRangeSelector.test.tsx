/**
 * HealthMetricsRangeSelector.test.tsx
 *
 * Tests the range-selector component and the `useHealthMetricsRange` hook in
 * isolation, plus a smoke test for CommitmentHealthMetrics integration.
 *
 * Run with:  pnpm test
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import HealthMetricsRangeSelector, {
  RANGE_OPTIONS,
  type RangeKey,
} from "./HealthMetricsRangeSelector";
import { useHealthMetricsRange, rangeStartDate } from "./useHealthMetricsRange";
import CommitmentHealthMetrics, {
  type TimeSeriesPoint,
} from "./CommitmentHealthMetrics";
import { renderHook, act } from "@testing-library/react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDay(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Builds a minimal TimeSeriesPoint array with dates distributed across time. */
function buildSeries(daysBack: number[]): TimeSeriesPoint[] {
  return daysBack.map((n) => ({ date: isoDay(n), value: n * 10 }));
}

// ─── HealthMetricsRangeSelector ───────────────────────────────────────────────

describe("HealthMetricsRangeSelector", () => {
  it("renders all four range options", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="30d" onChange={onChange} />
    );
    for (const opt of RANGE_OPTIONS) {
      expect(screen.getByTestId(`range-btn-${opt.key}`)).toBeTruthy();
    }
  });

  it("marks only the selected option as aria-pressed=true", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="90d" onChange={onChange} />
    );
    for (const opt of RANGE_OPTIONS) {
      const btn = screen.getByTestId(`range-btn-${opt.key}`);
      expect(btn.getAttribute("aria-pressed")).toBe(
        opt.key === "90d" ? "true" : "false"
      );
    }
  });

  it("calls onChange with the correct key when a button is clicked", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="30d" onChange={onChange} />
    );
    fireEvent.click(screen.getByTestId("range-btn-7d"));
    expect(onChange).toHaveBeenCalledWith("7d");
  });

  it("moves focus and fires onChange on ArrowRight", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="7d" onChange={onChange} />
    );
    const firstBtn = screen.getByTestId("range-btn-7d");
    fireEvent.keyDown(firstBtn, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("30d");
  });

  it("moves focus and fires onChange on ArrowLeft and wraps around", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="7d" onChange={onChange} />
    );
    const firstBtn = screen.getByTestId("range-btn-7d");
    fireEvent.keyDown(firstBtn, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenCalledWith("all"); // wraps to last
  });

  it("has a group role with an aria-label", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="all" onChange={onChange} />
    );
    const group = screen.getByRole("group", {
      name: /health metrics date range/i,
    });
    expect(group).toBeTruthy();
  });

  it("all buttons have type=button to avoid accidental form submission", () => {
    const onChange = vi.fn();
    render(
      <HealthMetricsRangeSelector selected="all" onChange={onChange} />
    );
    for (const opt of RANGE_OPTIONS) {
      const btn = screen.getByTestId(`range-btn-${opt.key}`);
      expect(btn.getAttribute("type")).toBe("button");
    }
  });
});

// ─── useHealthMetricsRange ────────────────────────────────────────────────────

describe("useHealthMetricsRange", () => {
  // Use in-memory sessionStorage mock
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

  it("defaults to 30d when nothing is stored", () => {
    const { result } = renderHook(() => useHealthMetricsRange());
    expect(result.current.selectedRange).toBe("30d");
  });

  it("reads a previously persisted range from sessionStorage", () => {
    store["healthMetrics.selectedRange"] = "90d";
    const { result } = renderHook(() => useHealthMetricsRange());
    expect(result.current.selectedRange).toBe("90d");
  });

  it("setRange updates state and persists to sessionStorage", () => {
    const { result } = renderHook(() => useHealthMetricsRange());
    act(() => {
      result.current.setRange("all");
    });
    expect(result.current.selectedRange).toBe("all");
    expect(store["healthMetrics.selectedRange"]).toBe("all");
  });

  it("setRange ignores invalid values stored externally", () => {
    store["healthMetrics.selectedRange"] = "invalid-key";
    const { result } = renderHook(() => useHealthMetricsRange());
    expect(result.current.selectedRange).toBe("30d"); // falls back to default
  });

  describe("filterByRange", () => {
    const allKeys: RangeKey[] = ["7d", "30d", "90d", "all"];

    it.each(allKeys)("filters correctly for range %s", (key) => {
      store["healthMetrics.selectedRange"] = key;
      const { result } = renderHook(() => useHealthMetricsRange());

      // Points at 3d, 15d, 45d, 100d ago
      const data = buildSeries([3, 15, 45, 100]);
      const filtered = result.current.filterByRange(data, (p) => p.date);

      const expected: Record<RangeKey, number> = {
        "7d":  1, // only 3d
        "30d": 2, // 3d + 15d
        "90d": 3, // 3d + 15d + 45d
        "all": 4, // everything
      };
      expect(filtered).toHaveLength(expected[key]);
    });

    it("returns an empty array when no data falls within the range", () => {
      const { result } = renderHook(() => useHealthMetricsRange());
      // All points are older than 30d (default range)
      const data = buildSeries([40, 50, 60]);
      act(() => {
        result.current.setRange("7d");
      });
      const filtered = result.current.filterByRange(data, (p) => p.date);
      expect(filtered).toHaveLength(0);
    });

    it("accepts Date objects as well as ISO strings", () => {
      const { result } = renderHook(() => useHealthMetricsRange());
      act(() => { result.current.setRange("7d"); });

      const recent = new Date();
      recent.setDate(recent.getDate() - 3);
      const old = new Date();
      old.setDate(old.getDate() - 20);

      const data = [
        { date: recent, value: 1 },
        { date: old,    value: 2 },
      ];
      const filtered = result.current.filterByRange(data, (p) => p.date);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].value).toBe(1);
    });
  });
});

// ─── rangeStartDate utility ───────────────────────────────────────────────────

describe("rangeStartDate", () => {
  it("returns null for days=null (All)", () => {
    expect(rangeStartDate(null)).toBeNull();
  });

  it("returns a date approximately `days` days ago", () => {
    const result = rangeStartDate(7);
    expect(result).toBeInstanceOf(Date);
    const diffMs = Date.now() - result!.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Should be between 6.9 and 7.1 days in the past
    expect(diffDays).toBeGreaterThanOrEqual(6.9);
    expect(diffDays).toBeLessThanOrEqual(7.1);
  });

  it("resets to start of day (00:00:00.000)", () => {
    const result = rangeStartDate(30)!;
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

// ─── CommitmentHealthMetrics integration ──────────────────────────────────────

describe("CommitmentHealthMetrics", () => {
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

  const defaultProps = {
    commitmentId: "test-123",
    valueHistory:         buildSeries([3, 15, 45, 100]),
    drawdownHistory:      buildSeries([3, 15, 45, 100]),
    feeGenerationHistory: buildSeries([3, 15, 45, 100]),
    complianceHistory:    buildSeries([3, 15, 45, 100]),
  };

  it("renders the range selector", () => {
    render(<CommitmentHealthMetrics {...defaultProps} />);
    expect(
      screen.getByTestId("health-metrics-range-selector")
    ).toBeTruthy();
  });

  it("shows the empty-chart message when the range has no data", () => {
    render(
      <CommitmentHealthMetrics
        {...defaultProps}
        valueHistory={buildSeries([40, 50])} // all older than 30d
      />
    );
    // default range is 30d; value tab is active by default
    expect(screen.getByTestId("empty-chart-message")).toBeTruthy();
  });

  it("switching range updates the visible data (removes empty message after widening)", () => {
    render(
      <CommitmentHealthMetrics
        {...defaultProps}
        valueHistory={buildSeries([40, 50])} // older than 30d, within 90d
      />
    );

    // Should be empty on 30d default
    expect(screen.getByTestId("empty-chart-message")).toBeTruthy();

    // Widen to 90d
    fireEvent.click(screen.getByTestId("range-btn-90d"));

    // Empty message should be gone
    expect(screen.queryByTestId("empty-chart-message")).toBeNull();
  });

  it("all four chart tabs respect the active range filter", () => {
    // Only a recent point (within 7d) across all series
    const narrowData = buildSeries([3]);
    const wideData   = buildSeries([3, 100]);

    render(
      <CommitmentHealthMetrics
        commitmentId="test"
        valueHistory={wideData}
        drawdownHistory={wideData}
        feeGenerationHistory={wideData}
        complianceHistory={wideData}
      />
    );

    // Switch to 7d and verify each tab shows 1 point (no empty msg)
    fireEvent.click(screen.getByTestId("range-btn-7d"));

    const tabs: Array<[string, RegExp]> = [
      ["drawdown", /drawdown/i],
      ["fees", /fee generation/i],
      ["compliance", /compliance/i],
    ];
    for (const [label, matcher] of tabs) {
      fireEvent.click(screen.getByRole("button", { name: matcher }));
      expect(screen.queryByTestId("empty-chart-message")).toBeNull();
    }
  });

  it("switching to All shows all data even if it's old", () => {
    render(
      <CommitmentHealthMetrics
        {...defaultProps}
        valueHistory={buildSeries([400])} // very old
      />
    );

    // On 30d default it's empty
    expect(screen.getByTestId("empty-chart-message")).toBeTruthy();

    // Switch to All
    fireEvent.click(screen.getByTestId("range-btn-all"));

    expect(screen.queryByTestId("empty-chart-message")).toBeNull();
  });
});
