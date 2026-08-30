import { ValidationError } from './errors';

const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;
const SUPPORTED_ASSETS = ['XLM', 'USDC'];

export function validateSupportedAsset(asset: string, label = 'asset'): void {
  if (!asset || !SUPPORTED_ASSETS.includes(asset.toUpperCase())) {
    throw new ValidationError(`${label} is not supported. Supported assets: XLM, USDC.`);
  }
}

export function validateStellarAddress(address: string, label = 'ownerAddress'): void {
  if (!address || !STELLAR_ADDRESS_RE.test(address)) {
    throw new ValidationError(`${label} must be a valid Stellar public key (G..., 56 chars).`);
  }
}

