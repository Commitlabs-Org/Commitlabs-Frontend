import { describe, it, expect } from 'vitest';
import { formatRemaining } from '../formatRemaining';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

describe('formatRemaining', () => {
  describe('matured (diffMs <= 0)', () => {
    it('returns Matured when timestamps are equal', () => {
      expect(formatRemaining(1000, 1000)).toEqual({ text: 'Matured', status: 'matured' });
    });

    it('returns Matured when maturity is in the past', () => {
      expect(formatRemaining(1000, 2000)).toEqual({ text: 'Matured', status: 'matured' });
    });
  });

  describe('status thresholds', () => {
    it('critical when diff is exactly 1 day', () => {
      const maturity = 1000 + ONE_DAY_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '1d 0h 0m', status: 'critical' });
    });

    it('critical when diff is less than 1 day', () => {
      const maturity = 1000 + ONE_DAY_MS - 1;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '23h 59m', status: 'critical' });
    });

    it('warning when diff is exactly 7 days', () => {
      const maturity = 1000 + 7 * ONE_DAY_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '7d 0h 0m', status: 'warning' });
    });

    it('healthy when diff exceeds 7 days', () => {
      const maturity = 1000 + 7 * ONE_DAY_MS + 1;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '7d 0h 0m', status: 'healthy' });
    });

    it('warning when diff is just below 7 days', () => {
      const maturity = 1000 + 7 * ONE_DAY_MS - 1;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '6d 23h 59m', status: 'warning' });
    });

    it('healthy when diff is more than 7 days', () => {
      const maturity = 1000 + 8 * ONE_DAY_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '8d 0h 0m', status: 'healthy' });
    });
  });

  describe('text formatting', () => {
    it('includes days when days > 0', () => {
      const maturity = 1000 + 3 * ONE_DAY_MS + 5 * ONE_HOUR_MS + 30 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '3d 5h 30m', status: 'warning' });
    });

    it('omits days and hours when only minutes remain', () => {
      const maturity = 1000 + 45 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '45m', status: 'critical' });
    });

    it('omits days and shows hours when days is 0', () => {
      const maturity = 1000 + 2 * ONE_HOUR_MS + 15 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '2h 15m', status: 'critical' });
    });

    it('shows 0h when days > 0 and hours === 0', () => {
      const maturity = 1000 + 2 * ONE_DAY_MS + 30 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '2d 0h 30m', status: 'warning' });
    });

    it('always includes minutes', () => {
      const maturity = 1000 + 10 * ONE_DAY_MS + 7 * ONE_HOUR_MS + 0 * ONE_MINUTE_MS;
      expect(formatRemaining(maturity, 1000)).toEqual({ text: '10d 7h 0m', status: 'healthy' });
    });
  });
});
