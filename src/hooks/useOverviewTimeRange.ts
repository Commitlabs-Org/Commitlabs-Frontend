/**
 * useOverviewTimeRange
 *
 * Manages the active time-range selection for the commitments overview page.
 * Persists the chosen range in sessionStorage so it survives in-session
 * navigation without being carried across separate sessions.
 *
 * Default: 30d
 */

import { useCallback, useState } from "react";
import {
  OVERVIEW_RANGE_OPTIONS,
  type OverviewRangeKey,
} from "@/components/overview/OverviewTimeRangeSelector";

const SESSION_KEY = "overview.selectedRange";
const DEFAULT_RANGE: OverviewRangeKey = "30d";

const VALID_KEYS = new Set<string>(OVERVIEW_RANGE_OPTIONS.map((o) => o.key));

function readPersistedRange(): OverviewRangeKey {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && VALID_KEYS.has(stored)) {
      return stored as OverviewRangeKey;
    }
  } catch {
    // sessionStorage unavailable in SSR / private browsing
  }
  return DEFAULT_RANGE;
}

/**
 * Returns the start-of-day Date that is `days` calendar days before now,
 * or null when `days` is null (meaning "show everything").
 */
export function overviewRangeStartDate(days: number | null): Date | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface UseOverviewTimeRangeReturn {
  selectedRange: OverviewRangeKey;
  setRange: (range: OverviewRangeKey) => void;
  /** Filter any date-stamped array to items within the active range. */
  filterByRange: <T>(data: T[], getDate: (item: T) => string | Date) => T[];
  /** The start Date for the current range, or null for "all". */
  rangeStart: Date | null;
}

export function useOverviewTimeRange(): UseOverviewTimeRangeReturn {
  const [selectedRange, setSelectedRange] =
    useState<OverviewRangeKey>(readPersistedRange);

  const setRange = useCallback((range: OverviewRangeKey) => {
    setSelectedRange(range);
    try {
      sessionStorage.setItem(SESSION_KEY, range);
    } catch {
      // ignore write errors
    }
  }, []);

  const option = OVERVIEW_RANGE_OPTIONS.find((o) => o.key === selectedRange);
  const rangeStart = overviewRangeStartDate(option?.days ?? null);

  const filterByRange = useCallback(
    <T>(data: T[], getDate: (item: T) => string | Date): T[] => {
      if (rangeStart === null) return data;
      return data.filter((item) => {
        const d = getDate(item);
        const date = d instanceof Date ? d : new Date(d);
        return date >= rangeStart;
      });
    },
    [rangeStart]
  );

  return { selectedRange, setRange, filterByRange, rangeStart };
}

export default useOverviewTimeRange;
