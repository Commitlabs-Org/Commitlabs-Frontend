import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest"; // or 'jest' depending on your test runner
import { DEFAULT_WIDGET_LAYOUT, useWidgetLayout } from "./useWidgetLayout";

const STORAGE_KEY = "overview-widget-layout";

describe("useWidgetLayout", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should initialize with DEFAULT_WIDGET_LAYOUT when localStorage is empty", () => {
    const { result } = renderHook(() => useWidgetLayout());
    expect(result.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
  });

  it("should load valid configuration from localStorage", () => {
    const customLayout = [
      { id: "at-risk", label: "Custom Label", visible: false, order: 0 },
      {
        id: "commitment-detail",
        label: "Commitment Detail",
        visible: true,
        order: 1,
      },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customLayout));

    const { result } = renderHook(() => useWidgetLayout());
    expect(result.current.widgets).toEqual(customLayout);
  });

  it("should fall back to DEFAULT_WIDGET_LAYOUT if stored data is malformed or invalid", () => {
    // Test invalid JSON string
    window.localStorage.setItem(STORAGE_KEY, "{ invalid json }");
    const { result: r1 } = renderHook(() => useWidgetLayout());
    expect(r1.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);

    // Test missing properties in object
    const badShape = [{ id: "at-risk", label: "Missing visible and order" }];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(badShape));
    const { result: r2 } = renderHook(() => useWidgetLayout());
    expect(r2.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);

    // Test incorrect property type (e.g. visible as a string instead of boolean)
    const wrongType = [
      { id: "at-risk", label: "Label", visible: "true", order: 0 },
    ];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wrongType));
    const { result: r3 } = renderHook(() => useWidgetLayout());
    expect(r3.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
  });

  it("should reorder widgets and save to localStorage", () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.reorder(0, 1);
    });

    expect(result.current.widgets[0].id).toBe("commitment-detail");
    expect(result.current.widgets[0].order).toBe(0);
    expect(result.current.widgets[1].id).toBe("at-risk");
    expect(result.current.widgets[1].order).toBe(1);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toEqual(result.current.widgets);
  });

  it("should toggle widget visibility and save to localStorage", () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.toggleVisibility("at-risk");
    });

    const target = result.current.widgets.find((w) => w.id === "at-risk");
    expect(target?.visible).toBe(false);

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toEqual(result.current.widgets);
  });

  it("should reset layout to DEFAULT_WIDGET_LAYOUT and update localStorage", () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.toggleVisibility("at-risk");
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toEqual(DEFAULT_WIDGET_LAYOUT);
  });
});
