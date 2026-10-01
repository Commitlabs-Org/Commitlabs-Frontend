import { describe, expect, it } from 'vitest';
import { downsampleSeries, MAX_CHART_POINTS } from '../downsample';

describe('downsampleSeries', () => {
  it('returns an empty array for empty input', () => {
    expect(downsampleSeries([])).toEqual([]);
  });

  it('returns the array unchanged when within the bound', () => {
    const input = [{ date: 'a' }, { date: 'b' }, { date: 'c' }];
    const result = downsampleSeries(input, 5);
    expect(result).toEqual(input);
    expect(result.length).toBe(3);
  });

  it('does not exceed the max point count', () => {
    const input = Array.from({ length: 1000 }, (_, i) => ({ date: String(i), v: i }));
    const result = downsampleSeries(input, 50);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('preserves the first and last elements', () => {
    const input = Array.from({ length: 200 }, (_, i) => ({ date: String(i), v: i }));
    const result = downsampleSeries(input, 40);
    expect(result[0]).toEqual(input[0]);
    expect(result[result.length - 1]).toEqual(input[input.length - 1]);
  });

  it('keeps elements in the original order', () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const result = downsampleSeries(input, 25);
    expect([...result]).toEqual([...result].sort((a, b) => a - b));
    expect(result[result.length - 1]).toBe(99);
  });

  it('returns points with strictly increasing original indices', () => {
    const input = Array.from({ length: 100 }, (_, i) => i);
    const result = downsampleSeries(input, 20);
    for (let i = 1; i < result.length; i += 1) {
      const current = result[i] as number;
      const previous = result[i - 1] as number;
      expect(current).toBeGreaterThan(previous);
    }
  });

  it('is deterministic for the same input', () => {
    const input = Array.from({ length: 300 }, (_, i) => ({ date: String(i), v: i }));
    const a = downsampleSeries(input, 60);
    const b = downsampleSeries(input, 60);
    expect(a).toEqual(b);
  });

  it('handles undersized cap by clamping to 2', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = downsampleSeries(input, 1);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(1);
    expect(result[result.length - 1]).toBe(6);
  });

  it('exposes a sane default MAX_CHART_POINTS', () => {
    expect(MAX_CHART_POINTS).toBeGreaterThanOrEqual(2);
  });
});

describe('downsampleSeries default cap', () => {
  it('caps large arrays to MAX_CHART_POINTS by default', () => {
    const input = Array.from({ length: 10_000 }, (_, i) => i);
    const result = downsampleSeries(input);
    expect(result.length).toBeLessThanOrEqual(MAX_CHART_POINTS);
  });
});
