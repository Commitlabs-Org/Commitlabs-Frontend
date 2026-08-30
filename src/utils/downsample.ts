/**
 * Bounded series downsampling for charts.
 *
 * Chart components can receive an unbounded time-series from the backend.
 * Recharts renders one SVG point per element, so an unbounded series makes
 * DOM/SVG construction, layout, and paint costs grow without limit. This
 * module caps the number of rendered points deterministically so chart cost is
 * bounded regardless of backend shape.
 *
 * The sampler preserves the first and last points (so trends at both ends are
 * visible) and picks interior points at evenly spaced *index* offsets. It is a
 * deterministic, pure function: identical input always yields identical
 * output, which keeps tooltips and reference lines stable across renders.
 */

/** Default cap on chart points. Keep small enough to bound DOM/SVG cost. */
export const MAX_CHART_POINTS = 120;

/**
 * Downsample `series` to at most `maxPoints` elements, preserving order and the
 * first/last elements.
 *
 * - If `series.length <= maxPoints`, returns the array unchanged.
 * - Otherwise returns a new array with `maxPoints` elements. The element at
 *   index 0 and the last element are always kept; the remaining interior
 *   elements are picked by even index spacing.
 *
 * @param series    the raw time-series to bound
 * @param maxPoints the maximum number of points to keep (>= 2)
 */
export function downsampleSeries<T>(
  series: readonly T[],
  maxPoints: number = MAX_CHART_POINTS,
): T[] {
  if (!Array.isArray(series) || series.length === 0) {
    return [];
  }
  const cap = Math.max(2, Math.floor(maxPoints));
  if (series.length <= cap) {
    return series as T[];
  }

  const out: T[] = [series[0]];
  // Interior picks use even index spacing so coverage is uniform.
  const step = (series.length - 1) / (cap - 1);
  for (let i = 1; i < cap - 1; i += 1) {
    const idx = Math.round(i * step);
    out.push(series[idx]);
  }
  out.push(series[series.length - 1]);
  return out;
}
