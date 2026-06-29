/**
 * @file format.test.ts
 * Tests for src/utils/format.ts — covers rounding, currency, percent,
 * date formatting, and all null / undefined / NaN fallback paths.
 */

import {
  FORMAT_FALLBACK,
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
} from "../format";

// ── formatNumber ──────────────────────────────────────────────────────────────

describe("formatNumber", () => {
  // Happy path
  it("formats an integer with thousand separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats a float with specified decimals", () => {
    expect(formatNumber(1234567.891, { decimals: 2 })).toBe("1,234,567.89");
  });

  it("rounds correctly at the specified decimal boundary", () => {
    expect(formatNumber(1.005, { decimals: 2 })).toBe("1.01");
    expect(formatNumber(1.004, { decimals: 2 })).toBe("1.00");
  });

  it("defaults to 0 decimal places", () => {
    expect(formatNumber(9999.9)).toBe("10,000");
  });

  it("formats a string-encoded number", () => {
    expect(formatNumber("5000", { decimals: 0 })).toBe("5,000");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats negative numbers", () => {
    expect(formatNumber(-1234, { decimals: 0 })).toBe("-1,234");
  });

  it("formats with compact notation", () => {
    expect(formatNumber(1500000, { compact: true })).toBe("1.5M");
    expect(formatNumber(2300, { compact: true })).toBe("2.3K");
    expect(formatNumber(4000000000, { compact: true })).toBe("4B");
  });

  // Fallback paths
  it("returns fallback for null", () => {
    expect(formatNumber(null)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for undefined", () => {
    expect(formatNumber(undefined)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for NaN", () => {
    expect(formatNumber(NaN)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for Infinity", () => {
    expect(formatNumber(Infinity)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for non-numeric string", () => {
    expect(formatNumber("abc")).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for empty string", () => {
    expect(formatNumber("")).toBe(FORMAT_FALLBACK);
  });
});

// ── formatCurrency ────────────────────────────────────────────────────────────

describe("formatCurrency", () => {
  // Happy path
  it("formats USD by default with 2 decimal places", () => {
    expect(formatCurrency(9500)).toBe("$9,500.00");
  });

  it("formats EUR correctly", () => {
    // Intl formats EUR as "€9,500.00" in en-US locale
    expect(formatCurrency(9500, { currency: "EUR" })).toMatch(/9,500\.00/);
  });

  it("formats with custom decimal count", () => {
    expect(formatCurrency(100, { decimals: 0 })).toBe("$100");
  });

  it("formats a string-encoded amount", () => {
    expect(formatCurrency("250.5")).toBe("$250.50");
  });

  it("formats zero as currency", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative amounts", () => {
    expect(formatCurrency(-500)).toBe("-$500.00");
  });

  it("formats with compact notation", () => {
    expect(formatCurrency(1200000, { compact: true })).toMatch(/\$1\.2M/);
  });

  it("formats large numbers", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });

  // Fallback paths
  it("returns fallback for null", () => {
    expect(formatCurrency(null)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for undefined", () => {
    expect(formatCurrency(undefined)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for NaN", () => {
    expect(formatCurrency(NaN)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for Infinity", () => {
    expect(formatCurrency(Infinity)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for non-numeric string", () => {
    expect(formatCurrency("not-a-number")).toBe(FORMAT_FALLBACK);
  });
});

// ── formatPercent ─────────────────────────────────────────────────────────────

describe("formatPercent", () => {
  // Happy path — whole-number input (default)
  it("formats a whole-number percent with 1 decimal by default", () => {
    expect(formatPercent(12.34)).toBe("12.3%");
  });

  it("formats zero percent", () => {
    expect(formatPercent(0)).toBe("0.0%");
  });

  it("formats negative percent", () => {
    expect(formatPercent(-5.5)).toBe("-5.5%");
  });

  it("formats with custom decimals", () => {
    expect(formatPercent(12.3456, { decimals: 2 })).toBe("12.35%");
  });

  it("prepends + sign for positive when showSign is true", () => {
    expect(formatPercent(5, { showSign: true })).toBe("+5.0%");
  });

  it("does not prepend + for negative when showSign is true", () => {
    expect(formatPercent(-3, { showSign: true })).toBe("-3.0%");
  });

  it("does not prepend sign for zero when showSign is true", () => {
    expect(formatPercent(0, { showSign: true })).toBe("0.0%");
  });

  // Decimal fraction input
  it("converts decimal fraction when isDecimal is true", () => {
    expect(formatPercent(0.1234, { isDecimal: true })).toBe("12.3%");
  });

  it("handles 0.005 rounding with isDecimal", () => {
    expect(formatPercent(0.005, { isDecimal: true, decimals: 1 })).toBe("0.5%");
  });

  it("formats 1.0 decimal fraction as 100%", () => {
    expect(formatPercent(1, { isDecimal: true, decimals: 0 })).toBe("100%");
  });

  it("formats a string-encoded percent", () => {
    expect(formatPercent("25")).toBe("25.0%");
  });

  // Fallback paths
  it("returns fallback for null", () => {
    expect(formatPercent(null)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for undefined", () => {
    expect(formatPercent(undefined)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for NaN", () => {
    expect(formatPercent(NaN)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for Infinity", () => {
    expect(formatPercent(Infinity)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for non-numeric string", () => {
    expect(formatPercent("abc")).toBe(FORMAT_FALLBACK);
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  const isoDate = "2026-06-29T00:00:00.000Z";
  const dateObj = new Date(isoDate);

  // Happy path
  it("formats a Date object with medium style by default", () => {
    const result = formatDate(dateObj);
    expect(result).toMatch(/Jun/);
    expect(result).toMatch(/2026/);
  });

  it("formats an ISO string", () => {
    const result = formatDate(isoDate);
    expect(result).toMatch(/2026/);
  });

  it("formats epoch milliseconds", () => {
    const result = formatDate(dateObj.getTime());
    expect(result).toMatch(/2026/);
  });

  it("formats with short style", () => {
    const result = formatDate(dateObj, { style: "short" });
    // en-US short: "6/29/26" or similar
    expect(result).toMatch(/26/);
  });

  it("formats with long style", () => {
    const result = formatDate(dateObj, { style: "long" });
    expect(result).toMatch(/June/);
    expect(result).toMatch(/2026/);
  });

  it("formats with full style", () => {
    const result = formatDate(dateObj, { style: "full" });
    expect(result).toMatch(/2026/);
  });

  it("includes time when includeTime is true", () => {
    const result = formatDate(dateObj, { includeTime: true });
    // Should contain AM/PM or colon-separated time
    expect(result).toMatch(/AM|PM|:/);
  });

  // Fallback paths
  it("returns fallback for null", () => {
    expect(formatDate(null)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for undefined", () => {
    expect(formatDate(undefined)).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for an invalid date string", () => {
    expect(formatDate("not-a-date")).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for an Invalid Date object", () => {
    expect(formatDate(new Date("invalid"))).toBe(FORMAT_FALLBACK);
  });

  it("returns fallback for NaN epoch", () => {
    expect(formatDate(NaN)).toBe(FORMAT_FALLBACK);
  });
});

// ── FORMAT_FALLBACK constant ──────────────────────────────────────────────────

describe("FORMAT_FALLBACK", () => {
  it('equals "--"', () => {
    expect(FORMAT_FALLBACK).toBe("--");
  });
});