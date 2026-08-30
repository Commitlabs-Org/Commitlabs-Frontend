import { describe, expect, it } from 'vitest';
import { computeReconnectDelay, shouldContinueReconnecting } from '../sseBackoff';

describe('computeReconnectDelay', () => {
  it('returns base delay for the first attempt', () => {
    expect(computeReconnectDelay(1, 1000, 2, 30000)).toBe(1000);
  });

  it('returns base * factor for the second attempt', () => {
    expect(computeReconnectDelay(2, 1000, 2, 30000)).toBe(2000);
  });

  it('grows exponentially', () => {
    expect(computeReconnectDelay(3, 1000, 2, 30000)).toBe(4000);
    expect(computeReconnectDelay(4, 1000, 2, 30000)).toBe(8000);
    expect(computeReconnectDelay(5, 1000, 2, 30000)).toBe(16000);
  });

  it('caps delay at the max', () => {
    expect(computeReconnectDelay(20, 1000, 2, 30000)).toBe(30000);
  });

  it('does not exceed the max for large attempt numbers', () => {
    const max = 30000;
    for (let attempt = 1; attempt <= 100; attempt += 1) {
      expect(computeReconnectDelay(attempt, 1000, 2, max)).toBeLessThanOrEqual(max);
    }
  });

  it('clamps attempts below 1 to 1', () => {
    expect(computeReconnectDelay(0, 1000, 2, 30000)).toBe(1000);
    expect(computeReconnectDelay(-3, 1000, 2, 30000)).toBe(1000);
  });
});

describe('shouldContinueReconnecting', () => {
  it('continues while the attempt is within the cap', () => {
    expect(shouldContinueReconnecting(1, 10)).toBe(true);
    expect(shouldContinueReconnecting(10, 10)).toBe(true);
  });

  it('stops once the attempt exceeds the cap', () => {
    expect(shouldContinueReconnecting(11, 10)).toBe(false);
    expect(shouldContinueReconnecting(100, 10)).toBe(false);
  });
});
