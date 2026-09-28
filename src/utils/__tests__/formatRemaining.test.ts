import { describe, expect, it } from 'vitest';
import { formatRemaining } from '../formatRemaining';

const ONE_SECOND_MS = 1000;
const ONE_MINUTE_MS = 60 * ONE_SECOND_MS;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

describe('formatRemaining', () => {
  describe('matured case (diffMs <= 0)', () => {
    it('returns matured status when current time equals maturity time', () => {
      const baseTime = 1_700_000_000_000;
      expect(formatRemaining(baseTime, baseTime)).toEqual({
        text: 'Matured',
        status: 'matured',
      });
    });

    it('returns matured status when maturity time is in the past', () => {
      const current = 1_700_000_000_000;
      const maturity = current - 5 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: 'Matured',
        status: 'matured',
      });
    });

    it('uses Date.now by default when maturity timestamp is in the past', () => {
      const pastTime = Date.now() - 10_000;
      expect(formatRemaining(pastTime)).toEqual({
        text: 'Matured',
        status: 'matured',
      });
    });
  });

  describe('threshold boundaries', () => {
    const current = 1_700_000_000_000;

    it('returns critical status when remaining time is exactly one day', () => {
      const maturity = current + ONE_DAY_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '1d 0h 0m',
        status: 'critical',
      });
    });

    it('returns critical status when remaining time is less than one day', () => {
      const maturity = current + ONE_DAY_MS - 1;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '23h 59m',
        status: 'critical',
      });
    });

    it('returns critical status for small remaining durations under one hour', () => {
      const maturity = current + 30 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '30m',
        status: 'critical',
      });
    });

    it('returns warning status when remaining time is slightly greater than one day', () => {
      const maturity = current + ONE_DAY_MS + 1;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '1d 0h 0m',
        status: 'warning',
      });
    });

    it('returns warning status when remaining time is between one and seven days', () => {
      const maturity = current + 3 * ONE_DAY_MS + 4 * ONE_HOUR_MS + 15 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '3d 4h 15m',
        status: 'warning',
      });
    });

    it('returns warning status when remaining time is exactly seven days', () => {
      const maturity = current + 7 * ONE_DAY_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '7d 0h 0m',
        status: 'warning',
      });
    });

    it('returns healthy status when remaining time is strictly greater than seven days', () => {
      const maturity = current + 7 * ONE_DAY_MS + 1;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '7d 0h 0m',
        status: 'healthy',
      });
    });

    it('returns healthy status for long remaining durations', () => {
      const maturity = current + 14 * ONE_DAY_MS + 2 * ONE_HOUR_MS + 5 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, current)).toEqual({
        text: '14d 2h 5m',
        status: 'healthy',
      });
    });
  });

  describe('formatting branches (lines 33-35)', () => {
    const current = 1_700_000_000_000;

    it('includes days prefix and hours when days > 0 and hours > 0', () => {
      const maturity = current + 4 * ONE_DAY_MS + 6 * ONE_HOUR_MS + 20 * ONE_MINUTE_MS;
      const result = formatRemaining(maturity, current);
      expect(result.text).toBe('4d 6h 20m');
      expect(result.status).toBe('warning');
    });

    it('includes 0h when days > 0 and hours === 0', () => {
      const maturity = current + 2 * ONE_DAY_MS + 45 * ONE_MINUTE_MS;
      const result = formatRemaining(maturity, current);
      expect(result.text).toBe('2d 0h 45m');
      expect(result.status).toBe('warning');
    });

    it('omits days and includes hours when days === 0 and hours > 0', () => {
      const maturity = current + 5 * ONE_HOUR_MS + 12 * ONE_MINUTE_MS;
      const result = formatRemaining(maturity, current);
      expect(result.text).toBe('5h 12m');
      expect(result.status).toBe('critical');
    });

    it('omits days and hours when days === 0 and hours === 0', () => {
      const maturity = current + 42 * ONE_MINUTE_MS;
      const result = formatRemaining(maturity, current);
      expect(result.text).toBe('42m');
      expect(result.status).toBe('critical');
    });

    it('formats 0m when diff is less than one minute', () => {
      const maturity = current + 45 * ONE_SECOND_MS;
      const result = formatRemaining(maturity, current);
      expect(result.text).toBe('0m');
      expect(result.status).toBe('critical');
    });
  });
});
