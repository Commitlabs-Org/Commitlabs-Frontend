import { describe, it, expect } from 'vitest';
import * as sorobanUtils from '@/utils/soroban';

describe('Soroban Utils Stubs Removal', () => {
  it('should not export connectWallet anymore', () => {
    // @ts-expect-error - connectWallet should be removed
    expect(sorobanUtils.connectWallet).toBeUndefined();
  });

  it('should not export callContract anymore', () => {
    // @ts-expect-error - callContract should be removed
    expect(sorobanUtils.callContract).toBeUndefined();
  });

  it('should not export readContract anymore', () => {
    // @ts-expect-error - readContract should be removed
    expect(sorobanUtils.readContract).toBeUndefined();
  });

  it('should still export contractAddresses', () => {
    expect(sorobanUtils.contractAddresses).toBeDefined();
    expect(typeof sorobanUtils.contractAddresses.commitmentNFT).toBe('string');
  });

  it('should still export network constants', () => {
    expect(sorobanUtils.rpcUrl).toBeDefined();
    expect(sorobanUtils.networkPassphrase).toBeDefined();
  });
});
