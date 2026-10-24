import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEscrowClient,
  getDefaultPenalty,
  EscrowConfigurationError,
  RISK_PROFILES,
} from './escrow-client';
import { config } from '../config';
import { Client } from 'escrow-client';

vi.mock('../config', () => ({
  config: {
    escrowContractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4',
    passphrase: 'Test SDF Network ; September 2015',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  },
}));

describe('getEscrowClient', () => {
  const defaultContractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4';
  const defaultPassphrase = 'Test SDF Network ; September 2015';
  const defaultRpcUrl = 'https://soroban-testnet.stellar.org';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes contractId, networkPassphrase, and rpcUrl from config', () => {
    const client = getEscrowClient();

    expect(client).toBeInstanceOf(Client);
    expect(client.options.contractId).toBe(defaultContractId);
    expect(client.options.networkPassphrase).toBe(defaultPassphrase);
    expect(client.options.rpcUrl).toBe(defaultRpcUrl);
  });

  it('throws typed EscrowConfigurationError when contractId is missing', () => {
    // Override contractId with empty string
    expect(() => getEscrowClient({ contractId: '' })).toThrow(
      EscrowConfigurationError
    );
    expect(() => getEscrowClient({ contractId: '   ' })).toThrow(
      'Escrow contract ID is not configured'
    );
  });

  it('allows overriding contractId, networkPassphrase, and rpcUrl', () => {
    const customContractId = 'CBJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ';
    const customPassphrase = 'Public Global Stellar Network ; September 2015';
    const customRpcUrl = 'https://rpc.mainnet.stellar.org';

    const client = getEscrowClient({
      contractId: customContractId,
      networkPassphrase: customPassphrase,
      rpcUrl: customRpcUrl,
      allowHttp: true,
    });

    expect(client.options.contractId).toBe(customContractId);
    expect(client.options.networkPassphrase).toBe(customPassphrase);
    expect(client.options.rpcUrl).toBe(customRpcUrl);
    expect(client.options.allowHttp).toBe(true);
  });

  it('delegates signTransaction to the provided signer function when returning string (Freighter)', async () => {
    const mockFreighterSign = vi.fn().mockResolvedValue('AAAA_SIGNED_TRANSACTION_XDR');
    const publicKey = 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC';

    const client = getEscrowClient({
      publicKey,
      signTransaction: mockFreighterSign,
    });

    expect(client.options.signTransaction).toBeDefined();

    // Call the adapted signTransaction
    const result = await (client.options.signTransaction as any)('AAAA_UNSIGNED_TRANSACTION_XDR', {
      networkPassphrase: defaultPassphrase,
      address: publicKey,
    });

    expect(mockFreighterSign).toHaveBeenCalledTimes(1);
    expect(mockFreighterSign).toHaveBeenCalledWith(
      'AAAA_UNSIGNED_TRANSACTION_XDR',
      expect.objectContaining({
        networkPassphrase: defaultPassphrase,
        accountToSign: publicKey,
        address: publicKey,
      })
    );
    expect(result).toEqual({
      signedTxXdr: 'AAAA_SIGNED_TRANSACTION_XDR',
      signerAddress: publicKey,
    });
  });

  it('delegates signTransaction to the provided signer function when returning an object', async () => {
    const mockSigner = vi.fn().mockResolvedValue({
      signedTxXdr: 'AAAA_OBJECT_XDR',
      signerAddress: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC',
    });

    const client = getEscrowClient({
      signTransaction: mockSigner,
    });

    const result = await (client.options.signTransaction as any)('TEST_XDR', {
      networkPassphrase: defaultPassphrase,
    });

    expect(mockSigner).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      signedTxXdr: 'AAAA_OBJECT_XDR',
      signerAddress: 'GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVWAC',
    });
  });

  it('invokes getDefaultPenalty with correct RiskProfile tag', async () => {
    const spyGetDefaultPenalty = vi.spyOn(Client.prototype, 'get_default_penalty').mockResolvedValue({
      result: 300,
    } as any);

    const safePenalty = await getDefaultPenalty('safe');
    expect(safePenalty).toBe(300);
    expect(spyGetDefaultPenalty).toHaveBeenCalledWith({
      risk: RISK_PROFILES.safe,
    });

    const balancedPenalty = await getDefaultPenalty('balanced');
    expect(balancedPenalty).toBe(300);
    expect(spyGetDefaultPenalty).toHaveBeenCalledWith({
      risk: RISK_PROFILES.balanced,
    });

    const aggressivePenalty = await getDefaultPenalty('aggressive');
    expect(aggressivePenalty).toBe(300);
    expect(spyGetDefaultPenalty).toHaveBeenCalledWith({
      risk: RISK_PROFILES.aggressive,
    });
  });
});
