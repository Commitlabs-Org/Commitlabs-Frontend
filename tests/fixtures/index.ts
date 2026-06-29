/**
 * Shared typed fixture factories for tests.
 * Each factory returns a fully valid object with sensible defaults and accepts
 * partial overrides. Types are derived directly from domain/DTO sources so any
 * upstream type change breaks tests at compile time.
 */

import type { Commitment, MarketplaceListing, Attestation } from '@/lib/types/domain';
import type { CommitmentDto, AttestationDto } from '@/lib/backend/dto';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';
import type { Attestation as PanelAttestation } from '@/components/RecentAttestationsPanel/RecentAttestationsPanel';

// ---------------------------------------------------------------------------
// makeCommitment — domain Commitment (src/lib/types/domain.ts)
// ---------------------------------------------------------------------------

export function makeCommitment(overrides: Partial<Commitment> = {}): Commitment {
  return {
    id: 'CMT-001',
    type: 'Safe',
    status: 'Active',
    asset: 'XLM',
    amount: '10000',
    currentValue: '10500',
    changePercent: 5,
    durationProgress: 50,
    daysRemaining: 30,
    complianceScore: 95,
    maxLoss: '5%',
    currentDrawdown: '2%',
    createdDate: '2026-01-01T00:00:00.000Z',
    expiryDate: '2026-06-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeCommitmentDto — backend DTO (src/lib/backend/dto.ts)
// ---------------------------------------------------------------------------

export function makeCommitmentDto(overrides: Partial<CommitmentDto> = {}): CommitmentDto {
  return {
    commitmentId: 'CMT-001',
    ownerAddress: 'GOWNER000000000000000000000000000000000000000000000000',
    amount: '10000',
    assetCode: 'XLM',
    assetIssuer: null,
    durationDays: 90,
    maxLossPercent: 5,
    commitmentType: 'safe',
    status: 'active',
    nftTokenId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeListing — domain MarketplaceListing (src/lib/types/domain.ts)
// ---------------------------------------------------------------------------

export function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'LST-001',
    commitmentId: 'CMT-001',
    price: '1000',
    currencyAsset: 'USDC',
    sellerAddress: 'GSELLER00000000000000000000000000000000000000000000000',
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeAttestation — domain Attestation (src/lib/types/domain.ts)
// ---------------------------------------------------------------------------

export function makeAttestation(overrides: Partial<Attestation> = {}): Attestation {
  return {
    id: 'ATT-001',
    commitmentId: 'CMT-001',
    kind: 'health_check',
    verdict: 'pass',
    observedAt: '2026-01-01T12:00:00.000Z',
    title: 'Health check passed',
    description: 'All parameters within acceptable range.',
    txHash: '0xabc123',
    severity: 'ok',
    details: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeAttestationDto — backend DTO (src/lib/backend/dto.ts)
// ---------------------------------------------------------------------------

export function makeAttestationDto(overrides: Partial<AttestationDto> = {}): AttestationDto {
  return {
    attestationId: 'ATT-001',
    commitmentId: 'CMT-001',
    ownerAddress: 'GOWNER000000000000000000000000000000000000000000000000',
    kind: 'health_check',
    verdict: 'pass',
    observedAt: '2026-01-01T12:00:00.000Z',
    details: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makeMarketplaceCard — UI props (src/components/MarketplaceCard.tsx)
// ---------------------------------------------------------------------------

export function makeMarketplaceCard(overrides: Partial<MarketplaceCardProps> = {}): MarketplaceCardProps {
  return {
    id: '1',
    type: 'Safe',
    score: 90,
    amount: '$10,000',
    duration: '90 days',
    yield: '5.0%',
    maxLoss: '5%',
    owner: 'GOWNER00000000000000000000000000000000000000000000000000',
    price: '$1,000',
    forSale: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// makePanelAttestation — RecentAttestationsPanel Attestation UI type
// ---------------------------------------------------------------------------

export function makePanelAttestation(overrides: Partial<PanelAttestation> = {}): PanelAttestation {
  return {
    id: 'ATT-001',
    title: 'Health check passed',
    description: 'All parameters within acceptable range.',
    txHash: '0123456789abcdef0123456789abcdef',
    timestamp: '2026-01-01T12:00:00.000Z',
    severity: 'ok',
    ...overrides,
  };
}
