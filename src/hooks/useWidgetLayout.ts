"use client";

import { useCallback, useEffect, useState } from "react";

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

const STORAGE_KEY = "overview-widget-layout";

export const DEFAULT_WIDGET_LAYOUT: WidgetConfig[] = [
  { id: "at-risk", label: "At-Risk Commitments", visible: true, order: 0 },
  { id: "commitment-detail", label: "Commitment Detail", visible: true, order: 1 },
];

function loadFromStorage(): WidgetConfig[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as WidgetConfig[];
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(layout: WidgetConfig[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage not available; ignore
  }
}

export function useWidgetLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    const stored = loadFromStorage();
    return stored ?? DEFAULT_WIDGET_LAYOUT;
  });

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setWidgets(stored);
    }
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const moved = sorted.splice(fromIndex, 1)[0];
      if (!moved) return prev;
      sorted.splice(toIndex, 0, moved);
      const updated = sorted.map((w, i) => ({ ...w, order: i }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setWidgets((prev) => {
      const updated = prev.map((w) =>
        w.id === id ? { ...w, visible: !w.visible } : w
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    saveToStorage(DEFAULT_WIDGET_LAYOUT);
    setWidgets(DEFAULT_WIDGET_LAYOUT);
  }, []);

  return { widgets, reorder, toggleVisibility, reset };
}
