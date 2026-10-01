import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WIDGET_LAYOUT,
  WidgetId,
  WIDGET_LAYOUT_STORAGE_KEY,
  parseWidgetLayout,
  useWidgetLayout,
} from './useWidgetLayout';

const validLayout = [
  { id: WidgetId.AtRisk, label: 'Custom Label', visible: false, order: 0 },
  { id: WidgetId.CommitmentDetail, label: 'Commitment Detail', visible: true, order: 1 },
];

describe('parseWidgetLayout', () => {
  it('accepts a non-empty array of well-shaped widgets', () => {
    expect(parseWidgetLayout(validLayout)).toEqual(validLayout);
  });

  it('rejects non-arrays, empty arrays, and mixed invalid entries', () => {
    expect(parseWidgetLayout(null)).toBeNull();
    expect(parseWidgetLayout({})).toBeNull();
    expect(parseWidgetLayout([])).toBeNull();
    expect(parseWidgetLayout([{ ...validLayout[0], visible: 'true' }])).toBeNull();
    expect(parseWidgetLayout([{ ...validLayout[0], order: Number.NaN }])).toBeNull();
    expect(parseWidgetLayout([{ ...validLayout[0], id: '' }])).toBeNull();
    expect(parseWidgetLayout([{ id: 'at-risk', label: 'Missing fields' }])).toBeNull();
    expect(
      parseWidgetLayout([validLayout[0], { id: 1, label: 'x', visible: true, order: 1 }]),
    ).toBeNull();
  });
});

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

describe('useWidgetLayout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    });
  });

  it('uses DEFAULT_WIDGET_LAYOUT when storage is empty', () => {
    const { result } = renderHook(() => useWidgetLayout());
    expect(result.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
  });

  it('loads a valid layout from storage', () => {
    window.localStorage.setItem(WIDGET_LAYOUT_STORAGE_KEY, JSON.stringify(validLayout));
    const { result } = renderHook(() => useWidgetLayout());
    expect(result.current.widgets).toEqual(validLayout);
  });

  it('falls back to DEFAULT_WIDGET_LAYOUT for malformed storage', () => {
    const cases = [
      '{ invalid json }',
      JSON.stringify([{ id: 'at-risk', label: 'Missing visible and order' }]),
      JSON.stringify([{ id: 'at-risk', label: 'Label', visible: 'true', order: 0 }]),
      JSON.stringify([]),
      JSON.stringify([validLayout[0], { label: 'no id', visible: true, order: 1 }]),
    ];

    for (const value of cases) {
      window.localStorage.setItem(WIDGET_LAYOUT_STORAGE_KEY, value);
      const { result } = renderHook(() => useWidgetLayout());
      expect(result.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
    }
  });

  it('reorders widgets and persists the new order', () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.reorder(0, 1);
    });

    expect(result.current.widgets.map((widget) => widget.id)).toEqual([
      WidgetId.CommitmentDetail,
      WidgetId.AtRisk,
    ]);
    expect(result.current.widgets.map((widget) => widget.order)).toEqual([0, 1]);
    expect(JSON.parse(window.localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY) ?? '[]')).toEqual(
      result.current.widgets,
    );
  });

  it('toggles visibility and persists the change', () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.toggleVisibility(WidgetId.AtRisk);
    });

    expect(result.current.widgets.find((widget) => widget.id === WidgetId.AtRisk)?.visible).toBe(
      false,
    );
    expect(JSON.parse(window.localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY) ?? '[]')).toEqual(
      result.current.widgets,
    );
  });

  it('resets to DEFAULT_WIDGET_LAYOUT and updates storage', () => {
    const { result } = renderHook(() => useWidgetLayout());

    act(() => {
      result.current.toggleVisibility(WidgetId.AtRisk);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.widgets).toEqual(DEFAULT_WIDGET_LAYOUT);
    expect(JSON.parse(window.localStorage.getItem(WIDGET_LAYOUT_STORAGE_KEY) ?? '[]')).toEqual(
      DEFAULT_WIDGET_LAYOUT,
    );
  });
});
