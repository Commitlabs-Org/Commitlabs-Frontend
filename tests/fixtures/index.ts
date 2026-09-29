import { Keypair } from '@stellar/stellar-base';

export interface CommitmentDto {
  address: string;
  amount: string;
}

export interface Listing {
  owner: string;
  seller: string;
  amount: string;
}

export interface MarketplaceCard {
  owner: string;
  seller: string;
  amount: string;
}

const ownerKeypair = Keypair.random();
const sellerKeypair = Keypair.random();

export const OWNER_ADDRESS = ownerKeypair.publicKey();
export const SELLER_ADDRESS = sellerKeypair.publicKey();

export function makeCommitmentDto(overrides: Partial<CommitmentDto> = {}): CommitmentDto {
  return {
    address: OWNER_ADDRESS,
    amount: '100',
    ...overrides,
  };
}

export function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    owner: OWNER_ADDRESS,
    seller: SELLER_ADDRESS,
    amount: '100',
    ...overrides,
  };
}

export function makeMarketplaceCard(
  overrides: Partial<MarketplaceCard> = {},
): MarketplaceCard {
  return {
    owner: OWNER_ADDRESS,
    seller: SELLER_ADDRESS,
    amount: '100',
    ...overrides,
  };
}
