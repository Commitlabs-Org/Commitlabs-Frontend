import { Keypair } from '@stellar/stellar-sdk';
import type { Commitment, MarketplaceListing, Attestation } from '@/lib/types/domain';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

/**
 * Data transfer object representing a commitment.
 */
export interface CommitmentDto {
  commitmentId: string;
  ownerAddress: string;
  amount: string;
  assetCode: string;
  assetIssuer: string | null;
  durationDays: number;
  maxLossPercent: number;
  commitmentType: string;
  status: string;
  nftTokenId: string | null;
}

/**
 * Data transfer object representing an attestation.
 */
export interface AttestationDto {
  attestationId: string;
  commitmentId: string;
  ownerAddress: string;
  kind: string;
  verdict: 'pass' | 'fail' | 'unknown';
  observedAt: string;
  details?: Record<string, unknown>;
}

/**
 * Attestation structure expected by the RecentAttestationsPanel component.
 */
export interface PanelAttestation {
  id: string;
  title: string;
  description: string;
  txHash: string;
  timestamp: string | Date;
  severity: 'ok' | 'warning' | 'violation';
}

const OWNER_KEYPAIR = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 1));
const SELLER_KEYPAIR = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 2));

export const FIXTURE_OWNER_ADDRESS = OWNER_KEYPAIR.publicKey();
export const FIXTURE_SELLER_ADDRESS = SELLER_KEYPAIR.publicKey();
export const OWNER_ADDRESS = FIXTURE_OWNER_ADDRESS;
export const SELLER_ADDRESS = FIXTURE_SELLER_ADDRESS;

/**
 * Creates a valid domain Commitment fixture with optional overrides.
 */
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

/**
 * Creates a valid CommitmentDto fixture with optional overrides.
 */
export function makeCommitmentDto(overrides: Partial<CommitmentDto> = {}): CommitmentDto {
  return {
    commitmentId: 'CMT-001',
    ownerAddress: FIXTURE_OWNER_ADDRESS,
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

/**
 * Creates a valid MarketplaceListing fixture with optional overrides.
 */
export function makeListing(overrides: Partial<MarketplaceListing> = {}): MarketplaceListing {
  return {
    id: 'LST-001',
    commitmentId: 'CMT-001',
    price: '1000',
    currencyAsset: 'USDC',
    sellerAddress: FIXTURE_SELLER_ADDRESS,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Creates a valid domain Attestation fixture with optional overrides.
 */
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

/**
 * Creates a valid AttestationDto fixture with optional overrides.
 */
export function makeAttestationDto(overrides: Partial<AttestationDto> = {}): AttestationDto {
  return {
    attestationId: 'ATT-001',
    commitmentId: 'CMT-001',
    ownerAddress: FIXTURE_OWNER_ADDRESS,
    kind: 'health_check',
    verdict: 'pass',
    observedAt: '2026-01-01T12:00:00.000Z',
    details: {},
    ...overrides,
  };
}

/**
 * Creates a valid MarketplaceCardProps fixture with optional overrides.
 */
export function makeMarketplaceCard(
  overrides: Partial<MarketplaceCardProps> = {},
): MarketplaceCardProps {
  return {
    id: '1',
    type: 'Safe',
    score: 90,
    amount: '$10,000',
    duration: '90 days',
    yield: '5.0%',
    maxLoss: '5%',
    owner: FIXTURE_OWNER_ADDRESS,
    price: '$1,000',
    forSale: true,
    ...overrides,
  };
}

/**
 * Creates a valid PanelAttestation fixture with optional overrides.
 */
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
