import { describe, it, expect } from 'vitest';
import { StrKey } from '@stellar/stellar-sdk';
import {
  makeCommitment,
  makeCommitmentDto,
  makeListing,
  makeAttestation,
  makeAttestationDto,
  makeMarketplaceCard,
  makePanelAttestation,
  FIXTURE_OWNER_ADDRESS,
  FIXTURE_SELLER_ADDRESS,
  OWNER_ADDRESS,
  SELLER_ADDRESS,
} from '../index';

const BASE32_REGEX = /^[A-Z2-7]+$/;

describe('Stellar address fixture validation', () => {
  it('ensures fixture addresses conform to RFC 4648 base32 without 0, 1, 8, 9', () => {
    const addresses = [
      FIXTURE_OWNER_ADDRESS,
      FIXTURE_SELLER_ADDRESS,
      OWNER_ADDRESS,
      SELLER_ADDRESS,
    ];

    for (const address of addresses) {
      expect(address).toMatch(BASE32_REGEX);
      expect(address).not.toMatch(/[0189]/);
      expect(StrKey.isValidEd25519PublicKey(address)).toBe(true);
    }
  });

  it('ensures factory outputs use valid base32 Stellar addresses', () => {
    const commitmentDto = makeCommitmentDto();
    const listing = makeListing();
    const attestationDto = makeAttestationDto();
    const card = makeMarketplaceCard();

    const factoryAddresses = [
      commitmentDto.ownerAddress,
      listing.sellerAddress,
      attestationDto.ownerAddress,
      card.owner,
    ];

    for (const address of factoryAddresses) {
      expect(address).toBeDefined();
      expect(address).toMatch(BASE32_REGEX);
      expect(address).not.toMatch(/[0189]/);
      expect(StrKey.isValidEd25519PublicKey(address!)).toBe(true);
    }
  });
});

describe('makeCommitment', () => {
  it('returns a fully valid object with defaults', () => {
    const c = makeCommitment();
    expect(c.id).toBe('CMT-001');
    expect(c.type).toBe('Safe');
    expect(c.status).toBe('Active');
    expect(c.asset).toBe('XLM');
    expect(c.amount).toBe('10000');
    expect(c.complianceScore).toBe(95);
  });

  it('applies partial overrides', () => {
    const c = makeCommitment({ id: 'CMT-999', type: 'Aggressive', status: 'Violated' });
    expect(c.id).toBe('CMT-999');
    expect(c.type).toBe('Aggressive');
    expect(c.status).toBe('Violated');
    expect(c.asset).toBe('XLM');
  });

  it('overrides nested optional fields', () => {
    const c = makeCommitment({ complianceScore: 42, daysRemaining: 7 });
    expect(c.complianceScore).toBe(42);
    expect(c.daysRemaining).toBe(7);
  });

  it('overrides both createdAt and expiryDate independently', () => {
    const c = makeCommitment({
      createdAt: '2025-01-01T00:00:00.000Z',
      expiryDate: '2025-12-31T00:00:00.000Z',
    });
    expect(c.createdAt).toBe('2025-01-01T00:00:00.000Z');
    expect(c.expiryDate).toBe('2025-12-31T00:00:00.000Z');
  });

  it('each call returns an independent object', () => {
    const a = makeCommitment();
    const b = makeCommitment();
    expect(a).not.toBe(b);
  });
});

describe('makeCommitmentDto', () => {
  it('returns defaults with lowercase commitmentType and status', () => {
    const dto = makeCommitmentDto();
    expect(dto.commitmentId).toBe('CMT-001');
    expect(dto.commitmentType).toBe('safe');
    expect(dto.status).toBe('active');
    expect(dto.assetIssuer).toBeNull();
    expect(dto.nftTokenId).toBeNull();
    expect(dto.ownerAddress).toBe(FIXTURE_OWNER_ADDRESS);
  });

  it('applies partial overrides', () => {
    const dto = makeCommitmentDto({
      commitmentId: 'CMT-XYZ',
      commitmentType: 'aggressive',
      status: 'settled',
    });
    expect(dto.commitmentId).toBe('CMT-XYZ');
    expect(dto.commitmentType).toBe('aggressive');
    expect(dto.status).toBe('settled');
  });
});

describe('makeListing', () => {
  it('returns a fully valid listing with defaults', () => {
    const l = makeListing();
    expect(l.id).toBe('LST-001');
    expect(l.status).toBe('Active');
    expect(l.currencyAsset).toBe('USDC');
    expect(l.sellerAddress).toBe(FIXTURE_SELLER_ADDRESS);
  });

  it('applies partial overrides', () => {
    const l = makeListing({ id: 'LST-007', status: 'Sold', price: '5000' });
    expect(l.id).toBe('LST-007');
    expect(l.status).toBe('Sold');
    expect(l.price).toBe('5000');
    expect(l.currencyAsset).toBe('USDC');
  });

  it('can set commitmentId independently', () => {
    const l = makeListing({ commitmentId: 'CMT-ABC' });
    expect(l.commitmentId).toBe('CMT-ABC');
  });
});

describe('makeAttestation', () => {
  it('returns a fully valid attestation with defaults', () => {
    const a = makeAttestation();
    expect(a.id).toBe('ATT-001');
    expect(a.commitmentId).toBe('CMT-001');
    expect(a.kind).toBe('health_check');
    expect(a.verdict).toBe('pass');
    expect(a.severity).toBe('ok');
  });

  it('applies partial overrides', () => {
    const a = makeAttestation({ id: 'ATT-XYZ', verdict: 'fail', severity: 'violation' });
    expect(a.id).toBe('ATT-XYZ');
    expect(a.verdict).toBe('fail');
    expect(a.severity).toBe('violation');
    expect(a.commitmentId).toBe('CMT-001');
  });

  it('overrides details object', () => {
    const a = makeAttestation({ details: { complianceScore: 80, violation: true } });
    expect(a.details).toEqual({ complianceScore: 80, violation: true });
  });

  it('overrides nested optional fields individually', () => {
    const a = makeAttestation({ txHash: '0xdeadbeef', title: 'Custom title' });
    expect(a.txHash).toBe('0xdeadbeef');
    expect(a.title).toBe('Custom title');
  });

  it('can produce multiple independent instances', () => {
    const instances = Array.from({ length: 3 }, (_, i) =>
      makeAttestation({ id: `ATT-00${i + 1}` }),
    );
    expect(instances.map((a) => a.id)).toEqual(['ATT-001', 'ATT-002', 'ATT-003']);
  });
});

describe('makeAttestationDto', () => {
  it('returns defaults', () => {
    const dto = makeAttestationDto();
    expect(dto.attestationId).toBe('ATT-001');
    expect(dto.verdict).toBe('pass');
    expect(dto.kind).toBe('health_check');
    expect(dto.ownerAddress).toBe(FIXTURE_OWNER_ADDRESS);
  });

  it('applies partial overrides', () => {
    const dto = makeAttestationDto({
      attestationId: 'ATT-999',
      verdict: 'fail',
      kind: 'violation',
    });
    expect(dto.attestationId).toBe('ATT-999');
    expect(dto.verdict).toBe('fail');
    expect(dto.kind).toBe('violation');
  });
});

describe('makeMarketplaceCard', () => {
  it('returns a fully valid card with defaults', () => {
    const card = makeMarketplaceCard();
    expect(card.id).toBe('1');
    expect(card.type).toBe('Safe');
    expect(card.score).toBe(90);
    expect(card.forSale).toBe(true);
    expect(card.owner).toBe(FIXTURE_OWNER_ADDRESS);
  });

  it('applies partial overrides', () => {
    const card = makeMarketplaceCard({ id: '7', type: 'Balanced', score: 91, forSale: false });
    expect(card.id).toBe('7');
    expect(card.type).toBe('Balanced');
    expect(card.score).toBe(91);
    expect(card.forSale).toBe(false);
    expect(card.amount).toBe('$10,000');
  });

  it('accepts optional fields', () => {
    const card = makeMarketplaceCard({
      id: '2',
      type: 'Safe',
      score: 85,
      amount: '$5,000',
      duration: '60 days',
      yield: '4.0%',
      maxLoss: '4%',
      price: '$500',
      compareSelected: true,
      compareDisabled: false,
    });
    expect(card.compareSelected).toBe(true);
    expect(card.compareDisabled).toBe(false);
  });
});

describe('makePanelAttestation', () => {
  it('returns a fully valid panel attestation with defaults', () => {
    const a = makePanelAttestation();
    expect(a.id).toBe('ATT-001');
    expect(a.severity).toBe('ok');
    expect(typeof a.timestamp).toBe('string');
  });

  it('applies partial overrides including Date timestamp', () => {
    const ts = new Date('2025-06-01T00:00:00.000Z');
    const a = makePanelAttestation({ id: 'warning-1', severity: 'warning', timestamp: ts });
    expect(a.id).toBe('warning-1');
    expect(a.severity).toBe('warning');
    expect(a.timestamp).toBe(ts);
  });

  it('overrides title and description independently', () => {
    const a = makePanelAttestation({ title: 'Custom', description: 'Desc' });
    expect(a.title).toBe('Custom');
    expect(a.description).toBe('Desc');
  });
});
