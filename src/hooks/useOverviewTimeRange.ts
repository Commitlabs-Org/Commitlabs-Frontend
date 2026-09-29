import { useCallback, useState } from 'react';

export type OverviewRangeKey = '7d' | '30d' | '90d' | 'all';

const SESSION_KEY = 'overview.selectedRange';
const DEFAULT_RANGE: OverviewRangeKey = '30d';

const RANGE_DAYS: Record<OverviewRangeKey, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

const VALID_KEYS = new Set<string>(Object.keys(RANGE_DAYS));

function readPersistedRange(): OverviewRangeKey {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && VALID_KEYS.has(stored)) {
      return stored as OverviewRangeKey;
    }
  } catch {
    // sessionStorage may be unavailable during SSR or in private browsing.
  }
  return DEFAULT_RANGE;
}

export function overviewRangeStartDate(days: number | null): Date | null {
  if (days === null) return null;
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

export interface UseOverviewTimeRangeReturn {
  selectedRange: OverviewRangeKey;
  setRange: (range: OverviewRangeKey) => void;
  filterByRange: <T>(data: T[], getDate: (item: T) => string | Date) => T[];
  rangeStart: Date | null;
}

export function useOverviewTimeRange(): UseOverviewTimeRangeReturn {
  const [selectedRange, setSelectedRange] = useState<OverviewRangeKey>(readPersistedRange);

  const setRange = useCallback((range: OverviewRangeKey) => {
    setSelectedRange(range);
    try {
      sessionStorage.setItem(SESSION_KEY, range);
    } catch {
      // Ignore storage write failures.
    }
  }, []);

  const rangeStart = overviewRangeStartDate(RANGE_DAYS[selectedRange]);

  const filterByRange = useCallback(
    <T>(data: T[], getDate: (item: T) => string | Date): T[] => {
      if (rangeStart === null) return data;
      return data.filter((item) => {
        const value = getDate(item);
        const date = value instanceof Date ? value : new Date(value);
        return date >= rangeStart;
      });
    },
    [rangeStart],
  );

  return { selectedRange, setRange, filterByRange, rangeStart };
}

export default useOverviewTimeRange;
