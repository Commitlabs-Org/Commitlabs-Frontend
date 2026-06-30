/**
 * OverviewTimeRangeSelector
 *
 * A keyboard-accessible segmented control that scopes the commitments overview
 * KPIs, charts, and activity feed to a chosen time window (7d / 30d / 90d / All).
 *
 * Accessibility contract
 * ──────────────────────
 * • Each button carries `aria-pressed` so screen readers announce the active range.
 * • The group is wrapped in `<div role="group">` with an `aria-label`.
 * • Arrow-key navigation (←/→) moves focus between segments and activates the range.
 * • A visually-hidden live region announces the selected range to assistive tech.
 */

import React, { useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OverviewRangeKey = "7d" | "30d" | "90d" | "all";

export interface OverviewRangeOption {
  key: OverviewRangeKey;
  label: string;
  /** Number of calendar days to look back; null means "show everything". */
  days: number | null;
}

export const OVERVIEW_RANGE_OPTIONS: OverviewRangeOption[] = [
  { key: "7d",  label: "7 D",  days: 7   },
  { key: "30d", label: "30 D", days: 30  },
  { key: "90d", label: "90 D", days: 90  },
  { key: "all", label: "All",  days: null },
];

export interface OverviewTimeRangeSelectorProps {
  /** Currently selected range. */
  selected: OverviewRangeKey;
  /** Called whenever the user picks a different range. */
  onChange: (range: OverviewRangeKey) => void;
  /** Optional extra class names for the wrapper element. */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const OverviewTimeRangeSelector: React.FC<OverviewTimeRangeSelectorProps> = ({
  selected,
  onChange,
  className = "",
}) => {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [announcement, setAnnouncement] = useState<string>("");

  const handleSelect = useCallback(
    (option: OverviewRangeOption) => {
      onChange(option.key);
      setAnnouncement(`Time range changed to ${option.label}`);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      let next = -1;
      if (e.key === "ArrowRight") {
        next = (index + 1) % OVERVIEW_RANGE_OPTIONS.length;
      } else if (e.key === "ArrowLeft") {
        next = (index - 1 + OVERVIEW_RANGE_OPTIONS.length) % OVERVIEW_RANGE_OPTIONS.length;
      }
      if (next >= 0) {
        e.preventDefault();
        const nextOption = OVERVIEW_RANGE_OPTIONS[next];
        handleSelect(nextOption);
        buttonRefs.current[next]?.focus();
      }
    },
    [handleSelect]
  );

  return (
    <>
      <div
        role="group"
        aria-label="Commitments overview date range"
        className={`inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-1 gap-1 ${className}`}
        data-testid="overview-time-range-selector"
      >
        {OVERVIEW_RANGE_OPTIONS.map((option, index) => {
          const isActive = option.key === selected;
          return (
            <button
              key={option.key}
              ref={(el) => { buttonRefs.current[index] = el; }}
              type="button"
              aria-pressed={isActive}
              data-testid={`overview-range-btn-${option.key}`}
              onClick={() => handleSelect(option)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                "px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-1",
                isActive
                  ? "bg-zinc-700 text-cyan-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800",
              ].join(" ")}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Live region for assistive tech announcements */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="overview-range-announcement"
      >
        {announcement}
      </span>
    </>
  );
};

export default OverviewTimeRangeSelector;
