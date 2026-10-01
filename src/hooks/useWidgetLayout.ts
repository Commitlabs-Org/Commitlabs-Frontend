'use client';

import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';

export enum WidgetId {
  AtRisk = 'at-risk',
  CommitmentDetail = 'commitment-detail',
}

export interface WidgetConfig {
  id: string;
  label: string;
  visible: boolean;
  order: number;
}

export const WIDGET_LAYOUT_STORAGE_KEY = 'overview-widget-layout';

export const widgetConfigSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  visible: z.boolean(),
  order: z.number().finite(),
});

export const widgetLayoutSchema = z.array(widgetConfigSchema).nonempty();

export const DEFAULT_WIDGET_LAYOUT: WidgetConfig[] = [
  { id: WidgetId.AtRisk, label: 'At-Risk Commitments', visible: true, order: 0 },
  { id: WidgetId.CommitmentDetail, label: 'Commitment Detail', visible: true, order: 1 },
];

export function cloneWidgetLayout(layout: readonly WidgetConfig[]): WidgetConfig[] {
  return layout.map((widget) => ({ ...widget }));
}

export function parseWidgetLayout(raw: unknown): WidgetConfig[] | null {
  const parsed = widgetLayoutSchema.safeParse(raw);
  return parsed.success ? cloneWidgetLayout(parsed.data) : null;
}

function loadFromStorage(): WidgetConfig[] | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return parseWidgetLayout(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function saveToStorage(layout: WidgetConfig[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    return;
  }
}

function resolveInitialLayout(): WidgetConfig[] {
  return cloneWidgetLayout(loadFromStorage() ?? DEFAULT_WIDGET_LAYOUT);
}

export function useWidgetLayout() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(resolveInitialLayout);

  useEffect(() => {
    const stored = loadFromStorage();
    if (stored) {
      setWidgets(stored);
    }
  }, []);

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setWidgets((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= sorted.length ||
        toIndex >= sorted.length
      ) {
        return prev;
      }

      const [moved] = sorted.splice(fromIndex, 1);
      if (!moved) {
        return prev;
      }

      sorted.splice(toIndex, 0, moved);
      const updated = sorted.map((widget, order) => ({ ...widget, order }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const toggleVisibility = useCallback((id: string) => {
    setWidgets((prev) => {
      const updated = prev.map((widget) =>
        widget.id === id ? { ...widget, visible: !widget.visible } : widget,
      );
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const reset = useCallback(() => {
    const defaults = cloneWidgetLayout(DEFAULT_WIDGET_LAYOUT);
    saveToStorage(defaults);
    setWidgets(defaults);
  }, []);

  return { widgets, reorder, toggleVisibility, reset };
}
