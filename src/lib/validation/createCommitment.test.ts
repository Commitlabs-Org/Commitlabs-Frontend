import { describe, it, expect } from 'vitest';
import {
  SourceIdSchema,
  AmountSchema,
  AssetSchema,
  CommitmentTypeSchema,
  parseAmountStrict,
  DraftStateSchema,
  IdempotencyKeySchema,
  isValidSourceId,
  clampDurationDays,
  clampMaxLossPercent,
} from './createCommitment';

describe('SourceIdSchema', () => {
  it('accepts valid ids', () => {
    expect(SourceIdSchema.safeParse('CMT-42').success).toBe(true);
    expect(SourceIdSchema.safeParse('abc_123-XYZ').success).toBe(true);
  });
  it('rejects empty/whitespace', () => {
    expect(SourceIdSchema.safeParse('').success).toBe(false);
    expect(SourceIdSchema.safeParse('   ').success).toBe(false);
  });
  it('rejects path traversal and script', () => {
    expect(SourceIdSchema.safeParse('../etc').success).toBe(false);
    expect(SourceIdSchema.safeParse('<script>').success).toBe(false);
  });
  it('rejects too long', () => {
    expect(SourceIdSchema.safeParse('a'.repeat(65)).success).toBe(false);
  });
  it('isValidSourceId helper', () => {
    expect(isValidSourceId('valid_1')).toBe(true);
    expect(isValidSourceId('')).toBe(false);
  });
});

describe('AmountSchema / parseAmountStrict', () => {
  const valid = ['1', '0.5', '100.1234567', '1000000', ' 100 '];
  const invalid: unknown[] = [
    '',
    ' ',
    '0',
    '-5',
    'Infinity',
    'NaN',
    '1e5',
    '0.00000001',
    '12.34567890',
    'abc',
    null,
    undefined,
  ];
  it.each(valid)('accepts %s', (v) => {
    expect(AmountSchema.safeParse(v).success).toBe(true);
    expect(parseAmountStrict(v)).not.toBeNull();
  });
  it.each(invalid)('rejects %p', (v) => {
    // AmountSchema only handles strings, but parseAmountStrict handles unknowns
    if (typeof v === 'string') {
      // strings with spaces trimmed: AmountSchema rejects leading/trailing raw but trims; explicit check
      if (v.trim() !== v) {
        // parseAmountStrict trims so will accept " 100 " - we document this as valid after trim
      }
    }
    expect(parseAmountStrict(v)).toBeNull();
  });
  it('clampDurationDays', () => {
    expect(clampDurationDays(9999)).toBe(365);
    expect(clampDurationDays(-5)).toBe(1);
    expect(clampDurationDays(NaN)).toBe(90);
    expect(clampDurationDays(10)).toBe(10);
  });
  it('clampMaxLossPercent', () => {
    expect(clampMaxLossPercent(200)).toBe(100);
    expect(clampMaxLossPercent(-10)).toBe(0);
    expect(clampMaxLossPercent('bad')).toBe(100);
  });
});

describe('AssetSchema', () => {
  it('allows XLM/USDC only', () => {
    expect(AssetSchema.safeParse('XLM').success).toBe(true);
    expect(AssetSchema.safeParse('USDC').success).toBe(true);
    expect(AssetSchema.safeParse('ETH').success).toBe(false);
    expect(AssetSchema.safeParse('').success).toBe(false);
  });
});

describe('CommitmentTypeSchema', () => {
  it('validates enum', () => {
    expect(CommitmentTypeSchema.safeParse('safe').success).toBe(true);
    expect(CommitmentTypeSchema.safeParse('UNKNOWN').success).toBe(false);
  });
});

describe('DraftStateSchema', () => {
  it('accepts valid draft', () => {
    expect(
      DraftStateSchema.safeParse({
        step: 2,
        selectedType: 'balanced',
        commitmentType: 'balanced',
        amount: '100',
        asset: 'XLM',
        durationDays: 90,
        maxLossPercent: 50,
      }).success,
    ).toBe(true);
  });
  it('rejects out-of-range duration', () => {
    expect(
      DraftStateSchema.safeParse({
        step: 1,
        selectedType: null,
        commitmentType: 'safe',
        amount: '10',
        asset: 'XLM',
        durationDays: 9999,
        maxLossPercent: 50,
      }).success,
    ).toBe(false);
  });
  it('rejects tampered step', () => {
    expect(
      DraftStateSchema.safeParse({
        step: 99,
        selectedType: null,
        commitmentType: 'safe',
        amount: '10',
        asset: 'XLM',
        durationDays: 10,
        maxLossPercent: 10,
      }).success,
    ).toBe(false);
  });
});

describe('IdempotencyKeySchema', () => {
  it('accepts valid', () => {
    expect(IdempotencyKeySchema.safeParse('create-12345678-abc').success).toBe(true);
  });
  it('rejects invalid charset', () => {
    expect(IdempotencyKeySchema.safeParse('bad key!').success).toBe(false);
  });
  it('rejects too short', () => {
    expect(IdempotencyKeySchema.safeParse('short').success).toBe(false);
  });
});
