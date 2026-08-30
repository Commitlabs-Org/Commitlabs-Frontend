import Stellar from '@stellar/stellar-sdk';
import { z } from 'zod';
import { ForbiddenError, ValidationError } from './errors';
import type { ListingStatus, MarketplaceListing } from '@/types/marketplace';

export const EXPECTED_MARKETPLACE_NETWORK_PASSPHRASE =
  process.env.SOROBAN_NETWORK_PASSPHRASE ??
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ??
  'Test SDF Network ; September 2015';

const LISTING_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const COMMITMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const STELLAR_PUBLIC_KEY_PATTERN = /^G[A-Z2-7]{55}$/;
const SUPPORTED_MARKETPLACE_ASSETS = ['XLM', 'USDC'] as const;
const LISTING_STATUSES = [
  'Active',
  'Sold',
  'Cancelled',
] as const satisfies readonly ListingStatus[];

export const ListingIdSchema = z
  .string()
  .trim()
  .regex(
    LISTING_ID_PATTERN,
    'Listing ID must contain only letters, numbers, underscores, or hyphens.',
  );

export const MarketplaceNetworkSchema = z
  .string()
  .trim()
  .min(1, 'networkPassphrase is required')
  .refine(
    (value) => value === EXPECTED_MARKETPLACE_NETWORK_PASSPHRASE,
    'Wallet is connected to an unsupported Stellar network.',
  );

export const StellarAddressSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!STELLAR_PUBLIC_KEY_PATTERN.test(value)) return false;
    const strKey = Stellar.StrKey as
      { isValidEd25519PublicKey?: (address: string) => boolean } | undefined;
    return strKey?.isValidEd25519PublicKey?.(value) ?? true;
  }, 'Address must be a valid Stellar public key.');

export const MarketplaceCreateListingBoundarySchema = z
  .object({
    commitmentId: z
      .string()
      .trim()
      .regex(
        COMMITMENT_ID_PATTERN,
        'commitmentId must contain only letters, numbers, underscores, or hyphens.',
      ),
    price: z
      .string()
      .trim()
      .refine((value) => {
        if (!/^(?:0|[1-9]\d*)(?:\.\d{1,7})?$/.test(value)) return false;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }, 'price must be a positive decimal string with at most 7 decimal places.'),
    currencyAsset: z.enum(SUPPORTED_MARKETPLACE_ASSETS),
    sellerAddress: StellarAddressSchema,
    networkPassphrase: MarketplaceNetworkSchema,
  })
  .strict();

export const MarketplacePurchaseBoundarySchema = z
  .object({
    buyerAddress: StellarAddressSchema,
    networkPassphrase: MarketplaceNetworkSchema,
  })
  .strict();

export const IdempotencyKeySchema = z
  .string()
  .trim()
  .regex(
    IDEMPOTENCY_KEY_PATTERN,
    'Idempotency-Key must contain only letters, numbers, dots, underscores, colons, or hyphens.',
  );

export const MarketplaceListingSchema = z
  .object({
    id: ListingIdSchema,
    commitmentId: z.string().trim().regex(COMMITMENT_ID_PATTERN),
    price: z
      .string()
      .trim()
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }, 'Listing price must be a positive numeric string.'),
    currencyAsset: z.enum(SUPPORTED_MARKETPLACE_ASSETS),
    sellerAddress: StellarAddressSchema,
    status: z.enum(LISTING_STATUSES),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export interface MarketplacePurchaseResponse {
  listingId: string;
  commitmentId: string;
  buyerAddress: string;
  sellerAddress: string;
  txHash?: string;
  purchasedAt: string;
}

export function parseMarketplaceListingId(raw: unknown): string {
  const result = ListingIdSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError('Invalid listing ID', result.error.issues);
  }
  return result.data;
}

export function assertWalletMatchesSession(
  sessionAddress: string,
  submittedAddress: string,
  addressField: 'buyerAddress' | 'sellerAddress',
): void {
  if (sessionAddress !== submittedAddress) {
    throw new ForbiddenError('Wallet address does not match the authenticated session.', {
      addressField,
    });
  }
}

export function validateMarketplaceListingSnapshot(
  listing: unknown,
  expectedListingId: string,
): MarketplaceListing {
  const result = MarketplaceListingSchema.safeParse(listing);
  if (!result.success) {
    throw new ValidationError(
      'Marketplace listing response failed validation.',
      result.error.issues,
    );
  }

  if (result.data.id !== expectedListingId) {
    throw new ValidationError('Marketplace listing response did not match the requested listing.', {
      expectedListingId,
      actualListingId: result.data.id,
    });
  }

  return result.data;
}
