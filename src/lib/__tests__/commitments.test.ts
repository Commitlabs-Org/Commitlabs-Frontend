import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadCommitments,
  normalizeStoredAmount,
  projectedYield,
  resetCommitments,
  sampleCommitments,
  saveCommitments,
  validateCommitment,
  type Commitment,
} from '../commitments';

const KEY = 'commitlabs.commitments.v1';

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'CMT-1',
  type: 'balanced',
  asset: 'USDC',
  amount: 2500,
  durationDays: 30,
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  createdAt: 1_700_000_000_000,
  status: 'active',
  owner: null,
  txHash: null,
  ...overrides,
});

const store = (payload: unknown) => window.localStorage.setItem(KEY, JSON.stringify(payload));
const stored = () => JSON.parse(window.localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
  resetCommitments();
  window.localStorage.clear();
});

describe('normalizeStoredAmount', () => {
  it.each([
    [2500, '25000000000'],
    [0.5, '5000000'],
    [0, '0'],
    [0.0000001, '1'],
    [1000.25, '10002500000'],
  ])('converts legacy number %s to %s base units', (legacy, expected) => {
    expect(normalizeStoredAmount(legacy)).toBe(expected);
  });

  it('removes binary float noise from legacy values', () => {
    expect(normalizeStoredAmount(0.1 + 0.2)).toBe('3000000');
    expect(normalizeStoredAmount(1.005 * 100)).toBe('1005000000');
  });

  it('passes digit strings through and strips leading zeros', () => {
    expect(normalizeStoredAmount('25000000000')).toBe('25000000000');
    expect(normalizeStoredAmount('0007')).toBe('7');
    expect(normalizeStoredAmount('0000')).toBe('0');
  });

  it.each([-1, NaN, Infinity, 1e21, '', '1.5', '-5', '1e3', ' 5', 'abc', null, undefined, {}, [], true])(
    'rejects malformed value %j',
    (bad) => {
      expect(normalizeStoredAmount(bad)).toBeNull();
    },
  );
});

describe('validateCommitment amounts', () => {
  it('converts a legacy numeric record', () => {
    expect(validateCommitment(record())?.amount).toBe('25000000000');
  });

  it('keeps a current string record unchanged', () => {
    expect(validateCommitment(record({ amount: '25000000000' }))?.amount).toBe('25000000000');
  });

  it('rejects malformed amounts without throwing', () => {
    for (const amount of [-5, '1e3', 'abc', null, NaN, undefined]) {
      expect(validateCommitment(record({ amount }))).toBeNull();
    }
  });
});

describe('loadCommitments with legacy storage', () => {
  it('shows a legacy v1 array of numeric records exactly and rewrites it as v3 strings', () => {
    store([record({ amount: 1234.5 })]);
    const result = loadCommitments();
    expect(result.dropped).toBe(0);
    expect(result.items.map((c) => c.amount)).toEqual(['12345000000']);
    expect(stored()).toMatchObject({ version: 3, items: [{ amount: '12345000000' }] });
  });

  it('upgrades a v2 envelope with numeric amounts in place', () => {
    store({ version: 2, items: [record({ amount: 10000 }), record({ id: 'CMT-2', amount: 0.25 })] });
    const result = loadCommitments();
    expect(result.items.map((c) => c.amount)).toEqual(['100000000000', '2500000']);
    expect(stored().version).toBe(3);
    expect(stored().items.every((c: { amount: unknown }) => typeof c.amount === 'string')).toBe(true);
  });

  it('drops a malformed stored amount and keeps the rest, reporting the drop', () => {
    store({
      version: 2,
      items: [record({ amount: 'oops' }), record({ id: 'CMT-2', amount: -3 }), record({ id: 'CMT-3' })],
    });
    const result = loadCommitments();
    expect(result.corrupt).toBe(false);
    expect(result.dropped).toBe(2);
    expect(result.items.map((c) => c.id)).toEqual(['CMT-3']);
  });

  it('round trips new string records without rewriting them', () => {
    const [sample] = sampleCommitments();
    expect(saveCommitments([sample])).toBe(true);
    const before = window.localStorage.getItem(KEY);
    expect(loadCommitments().items).toEqual([sample]);
    expect(window.localStorage.getItem(KEY)).toBe(before);
  });
});

describe('projectedYield', () => {
  it('uses the contract integer yield math on the stored base units', () => {
    const c = validateCommitment(record({ amount: '10000000000', durationDays: 14 }))!;
    // 1,000 balanced (700 bps) for 14 days = 2.6849315... floored to 26_849_315 stroops
    expect(projectedYield(c)).toBe(26_849_315n);
  });
});

describe('sampleCommitments', () => {
  it('uses base-unit strings that validate', () => {
    const samples = sampleCommitments();
    expect(samples.map((c) => c.amount)).toEqual(['25000000000', '100000000000']);
    for (const s of samples) expect(validateCommitment(s)).not.toBeNull();
  });
});

const base: Commitment = {
  id: 'CMT-1',
  type: 'balanced',
  asset: 'USDC',
  amount: '10000000000',
  durationDays: 30,
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  createdAt: Date.now(),
  status: 'active',
  owner: 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
  txHash: null,
};

describe('CommitmentStatus validation', () => {
  it('accepts disputed and violated statuses', () => {
    for (const status of ['disputed', 'violated']) {
      const c = validateCommitment({ ...base, status });
      expect(c?.status).toBe(status);
    }
  });

  it('still rejects invalid statuses', () => {
    expect(validateCommitment({ ...base, status: 'frozen' as any })).toBeNull();
  });

  it('accepts commitments with a dispute record', () => {
    const c = validateCommitment({
      ...base,
      status: 'disputed',
      dispute: { reasonCategory: 2, reasonText: 'Fraud', disputedAt: new Date(), disputedBy: base.owner! },
    });
    expect(c?.dispute?.reasonCategory).toBe(2);
  });
});
