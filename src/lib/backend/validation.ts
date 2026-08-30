const SUPPORTED_ASSETS = new Set(['XLM', 'USDC']);
const STELLAR_ADDRESS_RE = /^G[A-Z2-7]{55}$/;

export function validateSupportedAsset(asset: string, label = 'asset'): void {
  if (!SUPPORTED_ASSETS.has(asset)) {
    throw new Error(`Unsupported ${label}: ${asset}. Supported: XLM, USDC`);
  }
}

export function validateStellarAddress(address: string, label = 'address'): void {
  if (!STELLAR_ADDRESS_RE.test(address)) {
    throw new Error(`Invalid ${label}: must be a valid Stellar address (G... 56 chars)`);
  }
}
