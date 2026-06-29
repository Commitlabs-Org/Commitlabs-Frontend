/**
 * @file format.ts
 * @description Centralised Intl-backed formatting utilities for locale-safe
 * display of numbers, currencies, percentages, and dates.
 *
 * All helpers accept `null | undefined | NaN` gracefully and return the
 * documented fallback string (`"--"`) so call sites never need to guard.
 *
 * Usage:
 * ```ts
 * import { formatNumber, formatCurrency, formatPercent, formatDate } from "@/utils/format";
 *
 * formatNumber(1234567.89, { decimals: 2 })   // "1,234,567.89"
 * formatCurrency(9500, { currency: "USD" })    // "$9,500.00"
 * formatPercent(0.1234, { decimals: 1 })       // "12.3%"
 * formatDate(new Date(), { style: "medium" })  // "Jun 29, 2026"
 * ```
 */

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Sentinel returned when a value cannot be meaningfully displayed. */
export const FORMAT_FALLBACK = "--";

/**
 * Coerce an unknown value to a finite number.
 * Returns `null` when the input is null / undefined / NaN / Infinity.
 */
function toFinite(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(n) ? n : null;
}

// ── formatNumber ──────────────────────────────────────────────────────────────

export interface FormatNumberOptions {
  /** Number of fraction digits (default: 0). */
  decimals?: number;
  /** BCP 47 locale tag (default: "en-US"). */
  locale?: string;
  /** Use compact notation — "1.2M" instead of "1,200,000" (default: false). */
  compact?: boolean;
}

/**
 * Format a plain number with thousand separators.
 *
 * @param value   — the number to format; null / undefined / NaN → `"--"`
 * @param options — optional locale / decimal / compact overrides
 * @returns formatted string or `"--"` on invalid input
 *
 * @example
 * formatNumber(1234567)              // "1,234,567"
 * formatNumber(1234567.5, { decimals: 2 }) // "1,234,567.50"
 * formatNumber(null)                 // "--"
 * formatNumber(NaN)                  // "--"
 * formatNumber(1500000, { compact: true }) // "1.5M"
 */
export function formatNumber(
  value: string | number | null | undefined,
  options: FormatNumberOptions = {}
): string {
  const n = toFinite(value);
  if (n === null) return FORMAT_FALLBACK;

  const { decimals = 0, locale = "en-US", compact = false } = options;

  return new Intl.NumberFormat(locale, {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 1 : decimals,
  }).format(n);
}

// ── formatCurrency ────────────────────────────────────────────────────────────

export interface FormatCurrencyOptions {
  /** ISO 4217 currency code (default: "USD"). */
  currency?: string;
  /** Number of fraction digits (default: 2). */
  decimals?: number;
  /** BCP 47 locale tag (default: "en-US"). */
  locale?: string;
  /** Use compact notation — "$1.2M" instead of "$1,200,000" (default: false). */
  compact?: boolean;
}

/**
 * Format a value as a currency amount using the Intl.NumberFormat API.
 *
 * @param value   — the amount to format; null / undefined / NaN → `"--"`
 * @param options — optional currency / locale / decimal / compact overrides
 * @returns formatted currency string or `"--"` on invalid input
 *
 * @example
 * formatCurrency(9500)                          // "$9,500.00"
 * formatCurrency(9500, { currency: "EUR" })     // "€9,500.00"
 * formatCurrency(1200000, { compact: true })    // "$1.2M"
 * formatCurrency(null)                          // "--"
 */
export function formatCurrency(
  value: string | number | null | undefined,
  options: FormatCurrencyOptions = {}
): string {
  const n = toFinite(value);
  if (n === null) return FORMAT_FALLBACK;

  const { currency = "USD", decimals = 2, locale = "en-US", compact = false } = options;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : decimals,
    maximumFractionDigits: compact ? 1 : decimals,
  }).format(n);
}

// ── formatPercent ─────────────────────────────────────────────────────────────

export interface FormatPercentOptions {
  /**
   * Number of fraction digits (default: 1).
   */
  decimals?: number;
  /**
   * When `true` the input is treated as a decimal fraction (0.05 → "5%").
   * When `false` (default) the input is treated as a whole-number percent
   * (5 → "5%").
   */
  isDecimal?: boolean;
  /**
   * Prepend "+" for positive values (default: false).
   */
  showSign?: boolean;
  /** BCP 47 locale tag (default: "en-US"). */
  locale?: string;
}

/**
 * Format a value as a percentage string.
 *
 * @param value   — the percentage to format; null / undefined / NaN → `"--"`
 * @param options — optional decimal / sign / locale overrides
 * @returns formatted percent string or `"--"` on invalid input
 *
 * @example
 * formatPercent(12.34)                        // "12.3%"
 * formatPercent(0.1234, { isDecimal: true })  // "12.3%"
 * formatPercent(5, { showSign: true })        // "+5.0%"
 * formatPercent(null)                         // "--"
 */
export function formatPercent(
  value: string | number | null | undefined,
  options: FormatPercentOptions = {}
): string {
  const n = toFinite(value);
  if (n === null) return FORMAT_FALLBACK;

  const { decimals = 1, isDecimal = false, showSign = false, locale = "en-US" } = options;
  const pct = isDecimal ? n : n / 100;

  const formatted = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(pct));

  const sign = showSign && n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}${formatted}`;
}

// ── formatDate ────────────────────────────────────────────────────────────────

export type FormatDateStyle = "short" | "medium" | "long" | "full";

export interface FormatDateOptions {
  /**
   * Intl.DateTimeFormat dateStyle preset (default: "medium").
   * - "short"  → "6/29/26"
   * - "medium" → "Jun 29, 2026"
   * - "long"   → "June 29, 2026"
   * - "full"   → "Monday, June 29, 2026"
   */
  style?: FormatDateStyle;
  /**
   * When `true`, also include the time portion using the matching timeStyle.
   * Default: false.
   */
  includeTime?: boolean;
  /** BCP 47 locale tag (default: "en-US"). */
  locale?: string;
}

/**
 * Format a Date (or ISO string / epoch ms) for locale-safe display.
 *
 * @param value   — a Date object, ISO 8601 string, or epoch milliseconds;
 *                  null / undefined / invalid date → `"--"`
 * @param options — optional style / time / locale overrides
 * @returns formatted date string or `"--"` on invalid input
 *
 * @example
 * formatDate(new Date("2026-06-29"))                     // "Jun 29, 2026"
 * formatDate("2026-06-29", { style: "short" })           // "6/29/26"
 * formatDate(1751155200000, { style: "long" })           // "June 29, 2026"
 * formatDate(new Date(), { includeTime: true })          // "Jun 29, 2026, 10:30 AM"
 * formatDate(null)                                       // "--"
 * formatDate("not-a-date")                               // "--"
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  options: FormatDateOptions = {}
): string {
  if (value === null || value === undefined) return FORMAT_FALLBACK;

  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return FORMAT_FALLBACK;

  const { style = "medium", includeTime = false, locale = "en-US" } = options;

  return new Intl.DateTimeFormat(locale, {
    dateStyle: style,
    ...(includeTime ? { timeStyle: style } : {}),
  }).format(date);
}