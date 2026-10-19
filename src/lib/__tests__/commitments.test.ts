import { describe, it, expect } from 'vitest';
import { validateCommitment, type Commitment } from '../commitments';

const base: Commitment = {
  id: 'CMT-1',
  type: 'balanced',
  asset: 'USDC',
  amount: 1000,
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
