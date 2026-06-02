import { describe, it, expect } from 'vitest';
import * as soroban from './soroban';

describe('soroban.ts - No stub functions', () => {
  it('should not export connectWallet stub function', () => {
    expect(soroban).not.toHaveProperty('connectWallet');
  });

  it('should not export callContract stub function', () => {
    expect(soroban).not.toHaveProperty('callContract');
  });

  it('should not export readContract stub function', () => {
    expect(soroban).not.toHaveProperty('readContract');
  });

  it('should export contractAddresses getters', () => {
    expect(soroban).toHaveProperty('contractAddresses');
    expect(typeof soroban.contractAddresses).toBe('object');
    expect(soroban.contractAddresses).toHaveProperty('commitmentNFT');
    expect(soroban.contractAddresses).toHaveProperty('commitmentCore');
    expect(soroban.contractAddresses).toHaveProperty('attestationEngine');
  });

  it('should export network configuration constants', () => {
    expect(soroban).toHaveProperty('rpcUrl');
    expect(typeof soroban.rpcUrl).toBe('string');
    expect(soroban).toHaveProperty('networkPassphrase');
    expect(typeof soroban.networkPassphrase).toBe('string');
  });

  it('should ensure contractAddresses getters return strings', () => {
    const addresses = soroban.contractAddresses;
    expect(typeof addresses.commitmentNFT).toBe('string');
    expect(typeof addresses.commitmentCore).toBe('string');
    expect(typeof addresses.attestationEngine).toBe('string');
  });
});
