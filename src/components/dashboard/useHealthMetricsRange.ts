/**
 * useHealthMetricsRange
 *
 * Manages the active time-range selection for health-metric charts.
 * Persists the chosen range in sessionStorage so it survives in-session
 * navigation without being carried across separate sessions.
 */

import { useCallback, useState } from "react";
import { RANGE_OPTIONS, type RangeKey } from "./HealthMetricsRangeSelector";

const SESSION_KEY = "healthMetrics.selectedRange";
const DEFAULT_RANGE: RangeKey = "30d";

const VALID_KEYS = new Set<string>(RANGE_OPTIONS.map((o) => o.key));

function readPersistedRange(): RangeKey {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored && VALID_KEYS.has(stored)) {
      return stored as RangeKey;
    }
  } catch {
    // sessionStorage unavailable (SSR / private browsing)
  }
  return DEFAULT_RANGE;
}

/** Returns the start-of-day Date that is `days` calendar days before now,
 *  or null when `days` is null (meaning "show everything"). */
export function rangeStartDate(days: number | null): Date | null {
  if (days === null) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface UseHealthMetricsRangeReturn {
  selectedRange: RangeKey;
  setRange: (range: RangeKey) => void;
  filterByRange: <T>(data: T[], getDate: (item: T) => string | Date) => T[];
}

export function useHealthMetricsRange(): UseHealthMetricsRangeReturn {
  const [selectedRange, setSelectedRange] = useState<RangeKey>(readPersistedRange);

  const setRange = useCallback((range: RangeKey) => {
    setSelectedRange(range);
    try {
      sessionStorage.setItem(SESSION_KEY, range);
    } catch {
      // ignore write errors
    }
  }, []);

  const filterByRange = useCallback(
    <T>(data: T[], getDate: (item: T) => string | Date): T[] => {
      const option = RANGE_OPTIONS.find((o) => o.key === selectedRange);
      const start = rangeStartDate(option?.days ?? null);
      if (start === null) return data;
      return data.filter((item) => {
        const d = getDate(item);
        const date = d instanceof Date ? d : new Date(d);
        return date >= start;
      });
    },
    [selectedRange]
  );

  return { selectedRange, setRange, filterByRange };
}

export default useHealthMetricsRange;
