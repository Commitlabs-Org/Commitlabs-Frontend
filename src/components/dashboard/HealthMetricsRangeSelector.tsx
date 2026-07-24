/**
 * HealthMetricsRangeSelector
 *
 * A keyboard-accessible segmented control that lets users scope all health-metric
 * charts to a meaningful time window (7 d / 30 d / 90 d / All).
 *
 * Accessibility contract
 * ──────────────────────
 * • Each button carries `aria-pressed` so screen readers announce the active range.
 * • The group is wrapped in a `<div role="group">` with an `aria-label`.
 * • Arrow-key navigation (←/→) moves focus between segments and activates the new range.
 */

import React, { useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RangeKey = "7d" | "30d" | "90d" | "all";

export interface RangeOption {
  key: RangeKey;
  label: string;
  /** Number of calendar days to look back; null means "show everything". */
  days: number | null;
}

export const RANGE_OPTIONS: RangeOption[] = [
  { key: "7d",  label: "7 D",  days: 7   },
  { key: "30d", label: "30 D", days: 30  },
  { key: "90d", label: "90 D", days: 90  },
  { key: "all", label: "All",  days: null },
];

export interface HealthMetricsRangeSelectorProps {
  /** Currently selected range. */
  selected: RangeKey;
  /** Called whenever the user picks a different range. */
  onChange: (range: RangeKey) => void;
  /** Optional extra class names for the wrapper element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HealthMetricsRangeSelector: React.FC<
  HealthMetricsRangeSelectorProps
> = ({ selected, onChange, className = "" }) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next = -1;
      if (e.key === "ArrowRight") {
        next = (index + 1) % RANGE_OPTIONS.length;
      } else if (e.key === "ArrowLeft") {
        next = (index - 1 + RANGE_OPTIONS.length) % RANGE_OPTIONS.length;
      }
      if (next >= 0) {
        e.preventDefault();
        const nextOption = RANGE_OPTIONS[next];
        onChange(nextOption.key);
        buttonRefs.current[next]?.focus();
      }
    },
    [onChange]
  );

  return (
    <div
      role="group"
      aria-label="Health metrics date range"
      className={`inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1 gap-1 ${className}`}
      data-testid="health-metrics-range-selector"
    >
      {RANGE_OPTIONS.map((option, index) => {
        const isActive = option.key === selected;
        return (
          <button
            key={option.key}
            ref={(el) => { buttonRefs.current[index] = el; }}
            type="button"
            aria-pressed={isActive}
            data-testid={`range-btn-${option.key}`}
            onClick={() => onChange(option.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
              isActive
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default HealthMetricsRangeSelector;
