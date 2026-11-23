import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keypair, Address, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import {
  validateGracePeriod,
  validateViolationThreshold,
  validateAddress,
  decodeAddress,
  decodeOptionAddress,
  decodeU64,
  decodeU32,
  getAdmin,
  getPendingAdmin,
  getGracePeriod,
  getViolationThreshold,
  getIsPaused,
  pause,
  unpause,
  setFeeRecipient,
  setGracePeriod,
  setViolationThreshold,
  proposeAdmin,
  acceptAdmin,
  cancelAdminProposal,
  MAX_LOCK_DURATION_SECONDS,
} from '../admin';
import { invokeContract, simulateRead } from '../tx';

vi.mock('../tx', () => ({
  invokeContract: vi.fn(),
  simulateRead: vi.fn(),
}));

const validAdmin = Keypair.random().publicKey();
const validNewAdmin = Keypair.random().publicKey();

beforeEach(() => {
  vi.resetAllMocks();
});

describe('admin validation helpers', () => {
  describe('validateGracePeriod', () => {
    it('accepts 0 seconds', () => {
      const res = validateGracePeriod('0');
      expect(res.valid).toBe(true);
      expect(res.value).toBe(0n);
    });

    it('accepts maximum lock duration (365 days = 31,536,000 seconds)', () => {
      const res = validateGracePeriod(MAX_LOCK_DURATION_SECONDS.toString());
      expect(res.valid).toBe(true);
      expect(res.value).toBe(MAX_LOCK_DURATION_SECONDS);
    });

    it('rejects grace period strictly greater than max lock duration', () => {
      const tooLarge = (MAX_LOCK_DURATION_SECONDS + 1n).toString();
      const res = validateGracePeriod(tooLarge);
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/exceeds maximum lock duration/i);
    });

    it('rejects negative numbers and decimals', () => {
      expect(validateGracePeriod('-1').valid).toBe(false);
      expect(validateGracePeriod('10.5').valid).toBe(false);
      expect(validateGracePeriod('abc').valid).toBe(false);
      expect(validateGracePeriod('').valid).toBe(false);
    });
  });

  describe('validateViolationThreshold', () => {
    it('accepts boundary values 0 and 100', () => {
      expect(validateViolationThreshold(0)).toEqual({ valid: true, value: 0 });
      expect(validateViolationThreshold('0')).toEqual({ valid: true, value: 0 });
      expect(validateViolationThreshold(100)).toEqual({ valid: true, value: 100 });
      expect(validateViolationThreshold('100')).toEqual({ valid: true, value: 100 });
    });

    it('accepts intermediate valid numbers', () => {
      expect(validateViolationThreshold('50')).toEqual({ valid: true, value: 50 });
      expect(validateViolationThreshold(80)).toEqual({ valid: true, value: 80 });
    });

    it('rejects 101', () => {
      const res = validateViolationThreshold('101');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/between 0 and 100/i);
    });

    it('rejects negative numbers, decimals, non-numbers, and empty input', () => {
      expect(validateViolationThreshold(-1).valid).toBe(false);
      expect(validateViolationThreshold('50.5').valid).toBe(false);
      expect(validateViolationThreshold('abc').valid).toBe(false);
      expect(validateViolationThreshold('').valid).toBe(false);
    });
  });

  describe('validateAddress', () => {
    it('accepts valid Stellar public key and contract addresses', () => {
      expect(validateAddress(validAdmin).valid).toBe(true);
      const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM';
      expect(validateAddress(contractId).valid).toBe(true);
    });

    it('rejects invalid or empty addresses', () => {
      expect(validateAddress('').valid).toBe(false);
      expect(validateAddress('invalid-address').valid).toBe(false);
      expect(validateAddress('G123').valid).toBe(false);
    });
  });
});

describe('admin decoding helpers', () => {
  it('decodeAddress decodes ScVal address and string', () => {
    const scVal = new Address(validAdmin).toScVal();
    expect(decodeAddress(scVal)).toBe(validAdmin);
    expect(decodeAddress(validAdmin)).toBe(validAdmin);
    expect(decodeAddress([validAdmin])).toBe(validAdmin);
    expect(decodeAddress(null)).toBeNull();
  });

  it('decodeOptionAddress decodes Some and None shapes', () => {
    expect(decodeOptionAddress(null)).toBeNull();
    expect(decodeOptionAddress([])).toBeNull();
    expect(decodeOptionAddress({ none: true })).toBeNull();
    expect(decodeOptionAddress([validAdmin])).toBe(validAdmin);
    expect(decodeOptionAddress({ some: validAdmin })).toBe(validAdmin);
    const scVal = nativeToScVal([new Address(validAdmin)]);
    expect(decodeOptionAddress(scVal)).toBe(validAdmin);
  });

  it('decodeU64 decodes bigints, numbers, and u64 ScVal', () => {
    expect(decodeU64(12345n)).toBe(12345n);
    expect(decodeU64(12345)).toBe(12345n);
    const scVal = nativeToScVal(9999n, { type: 'u64' });
    expect(decodeU64(scVal)).toBe(9999n);
  });

  it('decodeU32 decodes numbers and u32 ScVal', () => {
    expect(decodeU32(80)).toBe(80);
    const scVal = nativeToScVal(50, { type: 'u32' });
    expect(decodeU32(scVal)).toBe(50);
  });
});

describe('admin read functions', () => {
  it('getAdmin reads admin address from simulateRead', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: new Address(validAdmin).toScVal(),
    } as any);

    const admin = await getAdmin();
    expect(admin).toBe(validAdmin);
    expect(simulateRead).toHaveBeenCalledWith({ method: 'get_admin', args: [] });
  });

  it('getAdmin returns null when simulation errors', async () => {
    vi.mocked(simulateRead).mockResolvedValue({ error: 'Contract not initialized' });
    expect(await getAdmin()).toBeNull();
  });

  it('getPendingAdmin returns pending admin address when present', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([new Address(validNewAdmin)]),
    } as any);

    const pending = await getPendingAdmin();
    expect(pending).toBe(validNewAdmin);
    expect(simulateRead).toHaveBeenCalledWith({ method: 'get_pending_admin', args: [] });
  });

  it('getPendingAdmin returns null when none exists', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal([]),
    } as any);

    expect(await getPendingAdmin()).toBeNull();
  });

  it('getGracePeriod reads and decodes u64 seconds', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal(86400n, { type: 'u64' }),
    } as any);

    expect(await getGracePeriod()).toBe(86400n);
    expect(simulateRead).toHaveBeenCalledWith({ method: 'get_grace_period', args: [] });
  });

  it('getViolationThreshold reads and decodes u32 threshold', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal(85, { type: 'u32' }),
    } as any);

    expect(await getViolationThreshold()).toBe(85);
    expect(simulateRead).toHaveBeenCalledWith({ method: 'get_violation_threshold', args: [] });
  });

  it('getIsPaused reads and decodes boolean pause flag', async () => {
    vi.mocked(simulateRead).mockResolvedValue({
      result: nativeToScVal(true),
    } as any);

    expect(await getIsPaused()).toBe(true);
    expect(simulateRead).toHaveBeenCalledWith({ method: 'is_paused', args: [] });
  });
});

describe('admin write functions', () => {
  it('pause invokes pause method with caller as source and signer', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_pause' });

    const res = await pause(validAdmin);
    expect(res.transactionHash).toBe('tx_pause');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'pause',
      args: [],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('unpause invokes unpause method', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_unpause' });

    const res = await unpause(validAdmin);
    expect(res.transactionHash).toBe('tx_unpause');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'unpause',
      args: [],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('setFeeRecipient validates and invokes set_fee_recipient', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_fee' });

    const res = await setFeeRecipient({ newFeeRecipient: validNewAdmin, caller: validAdmin });
    expect(res.transactionHash).toBe('tx_fee');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'set_fee_recipient',
      args: [expect.any(Object)],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('setFeeRecipient throws on invalid address', async () => {
    await expect(
      setFeeRecipient({ newFeeRecipient: 'bad-address', caller: validAdmin }),
    ).rejects.toThrow(/invalid/i);
  });

  it('setGracePeriod validates and invokes set_grace_period', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_grace' });

    const res = await setGracePeriod({ gracePeriodSeconds: 7200n, caller: validAdmin });
    expect(res.transactionHash).toBe('tx_grace');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'set_grace_period',
      args: [expect.any(Object)],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('setGracePeriod throws when exceeding max lock duration', async () => {
    await expect(
      setGracePeriod({
        gracePeriodSeconds: MAX_LOCK_DURATION_SECONDS + 1n,
        caller: validAdmin,
      }),
    ).rejects.toThrow(/exceeds maximum lock duration/i);
  });

  it('setViolationThreshold validates and invokes set_violation_threshold', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_thresh' });

    const res = await setViolationThreshold({ threshold: 80, caller: validAdmin });
    expect(res.transactionHash).toBe('tx_thresh');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'set_violation_threshold',
      args: [expect.any(Object)],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('setViolationThreshold throws when threshold > 100', async () => {
    await expect(
      setViolationThreshold({ threshold: 101, caller: validAdmin }),
    ).rejects.toThrow(/between 0 and 100/i);
  });

  it('proposeAdmin validates and invokes propose_admin', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_prop' });

    const res = await proposeAdmin({ newAdmin: validNewAdmin, caller: validAdmin });
    expect(res.transactionHash).toBe('tx_prop');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'propose_admin',
      args: [expect.any(Object)],
      source: validAdmin,
      signer: validAdmin,
    });
  });

  it('acceptAdmin invokes accept_admin', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_accept' });

    const res = await acceptAdmin(validNewAdmin);
    expect(res.transactionHash).toBe('tx_accept');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'accept_admin',
      args: [],
      source: validNewAdmin,
      signer: validNewAdmin,
    });
  });

  it('cancelAdminProposal invokes cancel_admin_proposal', async () => {
    vi.mocked(invokeContract).mockResolvedValue({ transactionHash: 'tx_cancel' });

    const res = await cancelAdminProposal(validAdmin);
    expect(res.transactionHash).toBe('tx_cancel');
    expect(invokeContract).toHaveBeenCalledWith({
      method: 'cancel_admin_proposal',
      args: [],
      source: validAdmin,
      signer: validAdmin,
    });
  });
});
