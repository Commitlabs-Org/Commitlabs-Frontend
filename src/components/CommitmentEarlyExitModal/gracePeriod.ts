/**
 * Number of milliseconds in one calendar day (24 × 60 × 60 × 1 000 = 86 400 000).
 * Used throughout the grace-period module to convert between day counts and
 * absolute millisecond offsets.
 */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Represents the current phase of the early-exit grace-period countdown:
 *
 * - `'loading'` – Protocol timing data has not yet been fetched; the UI
 *   should show a loading/placeholder state.
 * - `'no_grace'` – The protocol configuration has a grace period of zero
 *   days (or `null` was normalised to 0), so no penalty-free window exists.
 *   The penalty is applied immediately.
 * - `'pre_grace'` – The commitment has not yet reached the grace-period
 *   window. A countdown to the window open date is shown; exiting now would
 *   incur a penalty.
 * - `'in_grace'` – The current time falls within the grace-period window
 *   (between the grace start date and the maturity date). The commitment
 *   can be exited penalty-free during this phase.
 */
export type GraceCountdownState = 'loading' | 'no_grace' | 'pre_grace' | 'in_grace';

/**
 * Return type of {@link getGraceCountdownStatus}. Describes the full
 * display state for the early-exit countdown banner.
 *
 * @property state – Current {@link GraceCountdownState}.
 * @property title – Short heading shown in the banner (e.g. "Penalty-free
 *   grace period").
 * @property detail – Longer explanatory text that may reference the
 *   countdown or penalty rules.
 * @property countdownLabel – Human-readable countdown string (e.g.
 *   `"2d 5h 12m 30s"`). Present only when `state` is `'pre_grace'`.
 * @property targetDate – The next meaningful date: either the maturity date
 *   (when `state` is `'in_grace'`) or the grace-period start date (when
 *   `state` is `'pre_grace'`).
 */
export interface GraceCountdownStatus {
  state: GraceCountdownState;
  title: string;
  detail: string;
  countdownLabel?: string;
  targetDate?: Date;
}

/**
 * Normalise a raw grace-period day count to a safe, non-negative integer.
 *
 * A commitment can be exited penalty-free during a window immediately
 * before its maturity date; that window is measured in whole days. This
 * helper ensures the raw value provided by the protocol is always
 * representable as a non-negative integer before further calculations.
 *
 * @param value – The raw grace-period day count from the protocol. May be
 *   `null` (data not yet loaded), `undefined`, or a non-finite number
 *   (e.g. `NaN` or `Infinity`).
 * @returns A non-negative integer. Returns `0` when the input is `null`,
 *   `undefined`, negative, non-finite, or otherwise not a valid finite
 *   number. Otherwise returns `Math.max(0, Math.floor(value))`.
 *
 * @example
 * ```ts
 * normalizeGracePeriodDays(7);    // 7
 * normalizeGracePeriodDays(3.9);  // 3 (floored)
 * normalizeGracePeriodDays(-1);   // 0 (clamped)
 * normalizeGracePeriodDays(null); // 0 (not yet loaded)
 * normalizeGracePeriodDays(NaN);  // 0 (invalid)
 * ```
 */
export function normalizeGracePeriodDays(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

/**
 * Calculate the date on which the early-exit grace period begins.
 *
 * The grace period is the penalty-free window that opens a fixed number of
 * days **before** a commitment's maturity date. This function subtracts the
 * (possibly zero) day count from the maturity date and returns the resulting
 * {@link Date}. If the grace period is zero days the returned date equals
 * the maturity date, meaning there is no penalty-free window.
 *
 * Internally the day count is first normalised via
 * {@link normalizeGracePeriodDays}, so passing `null`-adjacent values will
 * produce the maturity date itself.
 *
 * @param maturityDate – The date on which the commitment matures and the
 *   grace period ends.
 * @param gracePeriodDays – The number of calendar days in the grace period.
 *   Pass `0` for protocols with no grace period.
 * @returns A new {@link Date} representing the start of the grace window.
 *
 * @example
 * ```ts
 * const maturity = new Date('2026-08-01T00:00:00Z');
 * getGracePeriodStartDate(maturity, 7);
 * // => Date representing 2026-07-25T00:00:00Z
 * ```
 */
export function getGracePeriodStartDate(maturityDate: Date, gracePeriodDays: number): Date {
  return new Date(maturityDate.getTime() - normalizeGracePeriodDays(gracePeriodDays) * DAY_MS);
}

/**
 * Format a remaining-time interval (in milliseconds) into a compact,
 * human-readable countdown string for the grace-period banner.
 *
 * The output precision depends on the magnitude:
 *
 * | Largest unit present | Example (`reducedMotion=false`) |
 * |----------------------|---------------------------------|
 * | days | `"2d 5h 12m 30s"` |
 * | hours | `"5h 12m 30s"` |
 * | minutes | `"12m 30s"` |
 * | ≤ 0 ms | `"now"` |
 *
 * When `reducedMotion` is `true` the seconds component is omitted (and a
 * fallback of `"less than 1m"` is used for sub-minute intervals) so that
 * the UI does not visually tick for users who prefer reduced motion.
 *
 * @param msUntilTarget – Milliseconds remaining until the grace-period
 *   target date. Negative values are treated as `0`.
 * @param reducedMotion – When `true`, omit the seconds component from the
 *   output string. Defaults to `false`.
 * @returns A formatted countdown string such as `"2d 5h 12m 30s"`,
 *   `"5h 12m 30s"`, `"12m 30s"`, `"30s"`, `"now"`, or `"less than 1m"`.
 *
 * @example
 * ```ts
 * formatGraceCountdown(86_400_000 * 2 + 3_600_000 * 5);
 * // => "2d 5h 0m 0s"
 *
 * formatGraceCountdown(30_000, true);
 * // => "less than 1m"
 * ```
 */
export function formatGraceCountdown(msUntilTarget: number, reducedMotion = false): string {
  const safeMs = Math.max(0, msUntilTarget);
  if (safeMs <= 0) {
    return 'now';
  }

  const totalSeconds = Math.ceil(safeMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (reducedMotion) {
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return minutes > 0 ? `${minutes}m` : 'less than 1m';
  }

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Derive the full display state for the early-exit grace-period countdown
 * banner.
 *
 * This is the primary entry-point function that the commitment
 * early-exit modal calls on every render / timer tick. It determines
 * which {@link GraceCountdownState} applies based on the current time
 * and returns a {@link GraceCountdownStatus} with ready-to-render copy.
 *
 * **State resolution order:**
 *
 * 1. `gracePeriodDays` is `null` → `'loading'` – protocol timing data has
 *    not arrived yet; the UI should show a loading placeholder.
 * 2. After normalisation the day count is `0` → `'no_grace'` – the
 *    protocol has no penalty-free window; exiting incurs the full penalty
 *    immediately.
 * 3. `now` is **after** the grace-period start date → `'in_grace'` – the
 *    user is inside the penalty-free window and may exit freely until
 *    maturity.
 * 4. `now` is **before** the grace-period start date → `'pre_grace'` –
 *    the window has not opened yet; a live countdown to the window open
 *    date is included in `countdownLabel`.
 *
 * @param params – Configuration object.
 * @param params.gracePeriodDays – Number of grace-period days from the
 *   protocol, or `null` while the value is still loading.
 * @param params.maturityDate – The date on which the commitment matures.
 * @param params.now – The current timestamp. Accepting an explicit value
 *   (rather than using `Date.now()`) makes the function deterministic and
 *   easy to unit-test.
 * @param params.reducedMotion – Forwarded to {@link formatGraceCountdown};
 *   when `true`, the seconds component is omitted from the countdown label.
 *   Defaults to `false`.
 * @returns A {@link GraceCountdownStatus} describing the current state,
 *   title, detail text, and – when applicable – a `countdownLabel` and
 *   `targetDate`.
 *
 * @example
 * ```ts
 * const status = getGraceCountdownStatus({
 *   gracePeriodDays: 3,
 *   maturityDate: new Date('2026-08-01'),
 *   now: new Date('2026-07-29'),
 * });
 * // status.state === 'in_grace'
 * ```
 */
export function getGraceCountdownStatus({
  gracePeriodDays,
  maturityDate,
  now,
  reducedMotion = false,
}: {
  gracePeriodDays: number | null;
  maturityDate: Date;
  now: Date;
  reducedMotion?: boolean;
}): GraceCountdownStatus {
  if (gracePeriodDays === null) {
    return {
      state: 'loading',
      title: 'Checking grace period',
      detail: 'Loading protocol timing before calculating the early-exit grace window.',
    };
  }

  const normalizedGraceDays = normalizeGracePeriodDays(gracePeriodDays);
  if (normalizedGraceDays === 0) {
    return {
      state: 'no_grace',
      title: 'Penalty applies now',
      detail: 'This protocol configuration has no penalty-free grace period. Early exit uses the penalty shown below.',
    };
  }

  const graceStartsAt = getGracePeriodStartDate(maturityDate, normalizedGraceDays);
  if (now.getTime() >= graceStartsAt.getTime()) {
    return {
      state: 'in_grace',
      title: 'Penalty-free grace period',
      detail: `You are inside the ${normalizedGraceDays}-day grace period. Early exit is penalty-free until maturity.`,
      targetDate: maturityDate,
    };
  }

  const countdownLabel = formatGraceCountdown(
    graceStartsAt.getTime() - now.getTime(),
    reducedMotion,
  );

  return {
    state: 'pre_grace',
    title: 'Grace window opens in',
    detail: `Penalty applies now. Wait ${countdownLabel} to enter the ${normalizedGraceDays}-day penalty-free grace period.`,
    countdownLabel,
    targetDate: graceStartsAt,
  };
}
