import { describe, it, expect, beforeEach } from 'vitest';
import {
  createCommitment,
  listCommitments,
  getCommitment,
} from '@/lib/backend/mocks/contracts';

describe('mocks/contracts', () => {
  describe('createCommitment', () => {
    it('creates a commitment with sensible defaults', async () => {
      const commitment = await createCommitment({});

      expect(commitment.type).toBe('Safe');
      expect(commitment.status).toBe('Active');
      expect(commitment.asset).toBe('USDC');
      expect(commitment.amount).toBe('0');
      expect(typeof commitment.id).toBe('string');
      expect(commitment.id.length).toBeGreaterThan(0);
    });

    it('merges provided fields over the defaults', async () => {
      const commitment = await createCommitment({
        type: 'Balanced',
        asset: 'ETH',
        amount: '2500',
      });

      expect(commitment.type).toBe('Balanced');
      expect(commitment.asset).toBe('ETH');
      expect(commitment.amount).toBe('2500');
    });

    it('generates a UUID-shaped id, not the old short Math.random() string', async () => {
      const commitment = await createCommitment({});
      const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      expect(commitment.id).toMatch(uuidPattern);
    });

    it('generates unique ids across many repeated calls', async () => {
      const results = await Promise.all(
        Array.from({ length: 200 }, () => createCommitment({})),
      );
      const ids = results.map((c) => c.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('listCommitments', () => {
    it('returns an array that includes newly created commitments', async () => {
      const before = await listCommitments();
      const created = await createCommitment({ asset: 'XLM' });
      const after = await listCommitments();

      expect(after.length).toBe(before.length + 1);
      expect(after.some((c) => c.id === created.id)).toBe(true);
    });
  });

  describe('getCommitment', () => {
    it('returns the commitment matching a known id', async () => {
      const created = await createCommitment({ asset: 'BTC' });
      const found = await getCommitment(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.asset).toBe('BTC');
    });

    it('returns undefined for an id that does not exist', async () => {
      const found = await getCommitment('does-not-exist');
      expect(found).toBeUndefined();
    });
  });
});