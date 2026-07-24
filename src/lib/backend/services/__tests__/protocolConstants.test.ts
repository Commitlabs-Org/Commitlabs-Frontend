import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getProtocolConstants,
  invalidateProtocolConstantsCache,
} from '../protocolConstants';

describe('protocolConstants service', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    invalidateProtocolConstantsCache();
    // Reset env to known state
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('COMMITLABS_') || key.startsWith('SOROBAN_') || key.startsWith('NEXT_PUBLIC_')) {
        delete process.env[key];
      }
    });
  });

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('COMMITLABS_') || key.startsWith('SOROBAN_') || key.startsWith('NEXT_PUBLIC_')) {
        delete process.env[key];
      }
    });
    Object.assign(process.env, originalEnv);
    invalidateProtocolConstantsCache();
  });

  describe('constant derivation from defaults', () => {
    it('returns default fee constants when no env vars are set', () => {
      const constants = getProtocolConstants();
      expect(constants.fees.networkBaseFeeStroops).toBe(100);
      expect(constants.fees.platformFeePercent).toBe(0);
    });

    it('returns default commitment limits when no env vars are set', () => {
      const constants = getProtocolConstants();
      expect(constants.commitmentLimits.minAmountXlm).toBe(10);
      expect(constants.commitmentLimits.maxAmountXlm).toBe(1_000_000);
      expect(constants.commitmentLimits.minDurationDays).toBe(1);
      expect(constants.commitmentLimits.maxDurationDays).toBe(365);
      expect(constants.commitmentLimits.maxLossPercentCeiling).toBe(100);
    });

    it('returns default penalty tiers when no env vars are set', () => {
      const constants = getProtocolConstants();
      expect(constants.penalties).toHaveLength(3);
      expect(constants.penalties[0].type).toBe('safe');
      expect(constants.penalties[0].earlyExitPenaltyPercent).toBe(2);
      expect(constants.penalties[1].type).toBe('balanced');
      expect(constants.penalties[1].earlyExitPenaltyPercent).toBe(3);
      expect(constants.penalties[2].type).toBe('aggressive');
      expect(constants.penalties[2].earlyExitPenaltyPercent).toBe(5);
    });

    it('returns default protocol version and network passphrase', () => {
      const constants = getProtocolConstants();
      expect(constants.protocolVersion).toBe('v1');
      expect(constants.network).toBe('Test SDF Network ; September 2015');
    });

    it('derives constants from configured env vars', () => {
      process.env.COMMITLABS_NETWORK_BASE_FEE_STROOPS = '200';
      process.env.COMMITLABS_PLATFORM_FEE_PERCENT = '1.5';
      process.env.COMMITLABS_MIN_AMOUNT_XLM = '5';
      process.env.COMMITLABS_MAX_AMOUNT_XLM = '500000';
      process.env.COMMITLABS_MIN_DURATION_DAYS = '7';
      process.env.COMMITLABS_MAX_DURATION_DAYS = '180';
      process.env.COMMITLABS_MAX_LOSS_PERCENT_CEILING = '50';

      const constants = getProtocolConstants();
      expect(constants.fees.networkBaseFeeStroops).toBe(200);
      expect(constants.fees.platformFeePercent).toBe(1.5);
      expect(constants.commitmentLimits.minAmountXlm).toBe(5);
      expect(constants.commitmentLimits.maxAmountXlm).toBe(500000);
      expect(constants.commitmentLimits.minDurationDays).toBe(7);
      expect(constants.commitmentLimits.maxDurationDays).toBe(180);
      expect(constants.commitmentLimits.maxLossPercentCeiling).toBe(50);
    });

    it('derives protocol version from NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION', () => {
      process.env.NEXT_PUBLIC_ACTIVE_CONTRACT_VERSION = 'v2';
      const constants = getProtocolConstants();
      expect(constants.protocolVersion).toBe('v2');
    });

    it('falls back to ACTIVE_CONTRACT_VERSION if NEXT_PUBLIC not set', () => {
      process.env.ACTIVE_CONTRACT_VERSION = 'v3';
      const constants = getProtocolConstants();
      expect(constants.protocolVersion).toBe('v3');
    });

    it('prefers SOROBAN_NETWORK_PASSPHRASE over NEXT_PUBLIC_NETWORK_PASSPHRASE', () => {
      process.env.SOROBAN_NETWORK_PASSPHRASE = 'Public Global Stellar Network ; September 2015';
      process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE = 'Other Network';
      const constants = getProtocolConstants();
      expect(constants.network).toBe('Public Global Stellar Network ; September 2015');
    });

    it('falls back to non-finite env int values gracefully', () => {
      process.env.COMMITLABS_NETWORK_BASE_FEE_STROOPS = 'not-a-number';
      const constants = getProtocolConstants();
      expect(constants.fees.networkBaseFeeStroops).toBe(100);
    });

    it('falls back to non-finite env float values gracefully', () => {
      process.env.COMMITLABS_PLATFORM_FEE_PERCENT = 'NaN';
      const constants = getProtocolConstants();
      expect(constants.fees.platformFeePercent).toBe(0);
    });
  });

  describe('caching behaviour', () => {
    it('returns the same object reference on repeated calls (cache hit)', () => {
      const first = getProtocolConstants();
      const second = getProtocolConstants();
      expect(second).toBe(first);
    });

    it('returns a stable cachedAt timestamp across calls', () => {
      const first = getProtocolConstants();
      const second = getProtocolConstants();
      expect(second.cachedAt).toBe(first.cachedAt);
    });

    it('refreshes constants after invalidateProtocolConstantsCache()', () => {
      const first = getProtocolConstants();
      invalidateProtocolConstantsCache();
      const second = getProtocolConstants();
      expect(second).not.toBe(first);
    });

    it('picks up new env vars after cache invalidation', () => {
      const first = getProtocolConstants();
      expect(first.fees.networkBaseFeeStroops).toBe(100);

      invalidateProtocolConstantsCache();
      process.env.COMMITLABS_NETWORK_BASE_FEE_STROOPS = '300';
      const second = getProtocolConstants();
      expect(second.fees.networkBaseFeeStroops).toBe(300);
    });
  });

  describe('penalty tiers from env JSON', () => {
    it('parses valid COMMITLABS_PENALTY_TIERS_JSON', () => {
      const tiers = [
        { type: 'low', earlyExitPenaltyPercent: 1, description: 'Low risk' },
        { type: 'high', earlyExitPenaltyPercent: 10, description: 'High risk' },
      ];
      process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify(tiers);
      const constants = getProtocolConstants();
      expect(constants.penalties).toHaveLength(2);
      expect(constants.penalties[0].type).toBe('low');
      expect(constants.penalties[0].earlyExitPenaltyPercent).toBe(1);
      expect(constants.penalties[1].type).toBe('high');
    });

    it('auto-generates description when omitted in JSON', () => {
      const tiers = [{ type: 'custom', earlyExitPenaltyPercent: 4 }];
      process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify(tiers);
      const constants = getProtocolConstants();
      expect(constants.penalties[0].description).toContain('custom');
      expect(constants.penalties[0].description).toContain('4%');
    });

    it('throws when COMMITLABS_PENALTY_TIERS_JSON is not a JSON array', () => {
      process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify({ type: 'not-array' });
      expect(() => getProtocolConstants()).toThrow('COMMITLABS_PENALTY_TIERS_JSON must be a JSON array');
    });

    it('throws when a penalty tier is missing type', () => {
      const tiers = [{ earlyExitPenaltyPercent: 2 }];
      process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify(tiers);
      expect(() => getProtocolConstants()).toThrow(/missing a valid "type"/);
    });

    it('throws when a penalty tier is missing earlyExitPenaltyPercent', () => {
      const tiers = [{ type: 'custom' }];
      process.env.COMMITLABS_PENALTY_TIERS_JSON = JSON.stringify(tiers);
      expect(() => getProtocolConstants()).toThrow(/missing a numeric "earlyExitPenaltyPercent"/);
    });

    it('throws on invalid JSON in COMMITLABS_PENALTY_TIERS_JSON', () => {
      process.env.COMMITLABS_PENALTY_TIERS_JSON = '{invalid json}';
      expect(() => getProtocolConstants()).toThrow(/Failed to parse COMMITLABS_PENALTY_TIERS_JSON/);
    });
  });

  describe('bps conversions and boundary fee values', () => {
    it('handles zero platform fee (0%)', () => {
      process.env.COMMITLABS_PLATFORM_FEE_PERCENT = '0';
      const constants = getProtocolConstants();
      expect(constants.fees.platformFeePercent).toBe(0);
    });

    it('handles maximum platform fee (100%)', () => {
      process.env.COMMITLABS_PLATFORM_FEE_PERCENT = '100';
      const constants = getProtocolConstants();
      expect(constants.fees.platformFeePercent).toBe(100);
    });

    it('handles fractional basis-point fee (0.01%)', () => {
      process.env.COMMITLABS_PLATFORM_FEE_PERCENT = '0.01';
      const constants = getProtocolConstants();
      expect(constants.fees.platformFeePercent).toBe(0.01);
    });

    it('handles minimum amount boundary of 0 XLM', () => {
      process.env.COMMITLABS_MIN_AMOUNT_XLM = '0';
      const constants = getProtocolConstants();
      expect(constants.commitmentLimits.minAmountXlm).toBe(0);
    });

    it('handles max loss percent ceiling at 0%', () => {
      process.env.COMMITLABS_MAX_LOSS_PERCENT_CEILING = '0';
      const constants = getProtocolConstants();
      expect(constants.commitmentLimits.maxLossPercentCeiling).toBe(0);
    });
  });

  describe('return shape', () => {
    it('returns an object with all required top-level keys', () => {
      const constants = getProtocolConstants();
      expect(constants).toHaveProperty('protocolVersion');
      expect(constants).toHaveProperty('network');
      expect(constants).toHaveProperty('fees');
      expect(constants).toHaveProperty('penalties');
      expect(constants).toHaveProperty('commitmentLimits');
      expect(constants).toHaveProperty('cachedAt');
    });

    it('cachedAt is a valid ISO-8601 timestamp', () => {
      const constants = getProtocolConstants();
      expect(() => new Date(constants.cachedAt)).not.toThrow();
      expect(new Date(constants.cachedAt).toISOString()).toBe(constants.cachedAt);
    });
  });
});
