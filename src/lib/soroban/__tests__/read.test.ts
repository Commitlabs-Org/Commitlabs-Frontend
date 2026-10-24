import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeToScVal } from '@stellar/stellar-sdk';
import {
  validateCommitmentId,
  getCommitment,
  getAttestations,
  getDispute,
  isNotFoundError,
  normalizeCommitment,
  normalizeAttestation,
  normalizeDispute,
  MAX_U64,
} from '../read';
import { EscrowErrorCode, TxError } from '../errors';

describe('validateCommitmentId', () => {
  it('accepts valid decimal u64 strings', () => {
    expect(validateCommitmentId('0')).toEqual({ valid: true, value: 0n });
    expect(validateCommitmentId('1')).toEqual({ valid: true, value: 1n });
    expect(validateCommitmentId('42')).toEqual({ valid: true, value: 42n });
    expect(validateCommitmentId('1000000')).toEqual({ valid: true, value: 1000000n });
    expect(validateCommitmentId(MAX_U64.toString())).toEqual({ valid: true, value: MAX_U64 });
  });

  it('trims whitespace and validates', () => {
    expect(validateCommitmentId('  123  ')).toEqual({ valid: true, value: 123n });
  });

  it('rejects empty or whitespace-only inputs without RPC calls', () => {
    expect(validateCommitmentId('')).toMatchObject({ valid: false, error: expect.stringContaining('cannot be empty') });
    expect(validateCommitmentId('   ')).toMatchObject({ valid: false, error: expect.stringContaining('cannot be empty') });
  });

  it('rejects non-numeric inputs', () => {
    expect(validateCommitmentId('abc')).toMatchObject({ valid: false, error: expect.stringContaining('non-negative integer') });
    expect(validateCommitmentId('0x10')).toMatchObject({ valid: false, error: expect.stringContaining('non-negative integer') });
    expect(validateCommitmentId('123a')).toMatchObject({ valid: false, error: expect.stringContaining('non-negative integer') });
  });

  it('rejects negative numbers and decimals', () => {
    expect(validateCommitmentId('-1')).toMatchObject({ valid: false, error: expect.stringContaining('non-negative integer') });
    expect(validateCommitmentId('1.5')).toMatchObject({ valid: false, error: expect.stringContaining('non-negative integer') });
  });

  it('rejects numbers strictly greater than u64 max (2^64 - 1)', () => {
    const overflow = (MAX_U64 + 1n).toString();
    expect(validateCommitmentId(overflow)).toMatchObject({ valid: false, error: expect.stringContaining('out of range') });
    expect(validateCommitmentId('999999999999999999999999999')).toMatchObject({ valid: false, error: expect.stringContaining('out of range') });
  });
});

describe('Soroban read helpers with mocked simulation', () => {
  let mockServer: { simulateTransaction: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockServer = {
      simulateTransaction: vi.fn(),
    };
  });

  describe('getCommitment', () => {
    it('returns a normalized on-chain commitment record', async () => {
      const rawCommitment = {
        id: 0n,
        owner: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
        asset: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM',
        amount: 5000000000n,
        accrued_yield: 250000000n,
        risk: 'Balanced',
        status: 'Funded',
        maturity: 1735689600n,
        penalty_bps: 300,
        compliance_score: 95,
        created_at: 1733097600n,
        metadata: new Map([
          ['purpose', 'liquidity-escrow'],
          ['tier', 'gold'],
        ]),
      };

      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: nativeToScVal(rawCommitment),
        },
      });

      const res = await getCommitment('0', mockServer);

      expect(res.id).toBe('0');
      expect(res.owner).toBe('GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB');
      expect(res.asset).toBe('CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM');
      expect(res.amount).toBe(5000000000n);
      expect(res.accruedYield).toBe(250000000n);
      expect(res.risk).toBe('Balanced');
      expect(res.status).toBe('Funded');
      expect(res.maturity).toBe(1735689600n);
      expect(res.penaltyBps).toBe(300);
      expect(res.complianceScore).toBe(95);
      expect(res.createdAt).toBe(1733097600n);
      expect(res.metadata).toEqual({
        purpose: 'liquidity-escrow',
        tier: 'gold',
      });
    });

    it('throws NotFound error when contract returns NotFound (error code 3)', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: 'HostError: Error(Contract, #3)',
      });

      await expect(getCommitment('999', mockServer)).rejects.toThrow();

      try {
        await getCommitment('999', mockServer);
      } catch (err) {
        expect(isNotFoundError(err)).toBe(true);
      }
    });

    it('throws when simulation returns no return value and no error', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: null,
      });

      await expect(getCommitment('1', mockServer)).rejects.toThrow();
    });
  });

  describe('getAttestations', () => {
    it('returns empty list when no attestations are recorded', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: nativeToScVal([]),
        },
      });

      const res = await getAttestations('0', mockServer);
      expect(res).toEqual([]);
    });

    it('returns non-empty attestations sorted newest first', async () => {
      const rawRecords = [
        {
          attestor: 'GATTESTOR11111111111111111111111111111111111111111111111',
          compliance_score: 80,
          timestamp: 1700000100n, // older
        },
        {
          attestor: 'GATTESTOR22222222222222222222222222222222222222222222222',
          compliance_score: 95,
          timestamp: 1700000500n, // newest
        },
        {
          attestor: 'GATTESTOR33333333333333333333333333333333333333333333333',
          compliance_score: 90,
          timestamp: 1700000300n, // middle
        },
      ];

      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: nativeToScVal(rawRecords),
        },
      });

      const res = await getAttestations('0', mockServer);
      expect(res).toHaveLength(3);
      // Verify sorted newest first
      expect(res[0].timestamp).toBe(1700000500n);
      expect(res[0].attestor).toBe('GATTESTOR22222222222222222222222222222222222222222222222');
      expect(res[0].complianceScore).toBe(95);

      expect(res[1].timestamp).toBe(1700000300n);
      expect(res[1].complianceScore).toBe(90);

      expect(res[2].timestamp).toBe(1700000100n);
      expect(res[2].complianceScore).toBe(80);
    });
  });

  describe('getDispute', () => {
    it('returns null when commitment has no dispute (None)', async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: nativeToScVal(null),
        },
      });

      const res = await getDispute('0', mockServer);
      expect(res).toBeNull();
    });

    it('returns normalized dispute record when dispute exists (Some)', async () => {
      const rawDispute = {
        reason_category: 2, // FraudSuspicion
        reason_text: 'Unauthorized transfer attempt flagged by sentinel',
        disputed_at: 1734000000n,
        disputed_by: 'GADMIN1111111111111111111111111111111111111111111111111',
      };

      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: nativeToScVal(rawDispute),
        },
      });

      const res = await getDispute('0', mockServer);
      expect(res).not.toBeNull();
      expect(res?.reasonCategory).toBe('Fraud Suspicion');
      expect(res?.reasonCode).toBe(2);
      expect(res?.reasonText).toBe('Unauthorized transfer attempt flagged by sentinel');
      expect(res?.disputedAt).toBe(1734000000n);
      expect(res?.disputedBy).toBe('GADMIN1111111111111111111111111111111111111111111111111');
    });
  });

  describe('isNotFoundError', () => {
    it('identifies TxError with code 3 as NotFound', () => {
      const err = new TxError('contract', 'The requested commitment could not be found.', {
        code: EscrowErrorCode.NotFound,
      });
      expect(isNotFoundError(err)).toBe(true);
    });

    it('identifies errors with NotFound or #3 message text', () => {
      expect(isNotFoundError(new Error('HostError: Error(Contract, #3)'))).toBe(true);
      expect(isNotFoundError(new Error('Commitment not found on chain'))).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect(isNotFoundError(new Error('Network timeout'))).toBe(false);
      expect(isNotFoundError(null)).toBe(false);
      expect(isNotFoundError(undefined)).toBe(false);
    });
  });
});
