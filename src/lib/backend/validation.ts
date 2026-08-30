import { ValidationError } from '@/lib/backend/errors';

/**
 * Canonical regex for a Stellar public key (ed25519 account ID).
 *
 * A Stellar G-address is a 56-character base32 string whose first character is
 * a constant version byte (`G`), encoded in an alphabet that omits the easily
 * confused characters `0`, `O`, `I`, and `L`. Rejecting those characters is a
 * hardening choice that mirrors the stricter 56-char pattern already used for
 * `EarlyExitRequestBodySchema` while also excluding visually ambiguous input.
 */
export const STELLAR_PUBLIC_KEY_REGEX = /^G[A-HJ-NP-Z0-9]{55}$/;

/**
 * Assets the application supports for commitments. Kept in one place so the
 * supported set is a single source of truth between validation and the API.
 */
export const SUPPORTED_ASSETS = ['XLM', 'USDC'] as const;

export type SupportedAsset = (typeof SUPPORTED_ASSETS)[number];

/**
 * Validate that `asset` is a supported commitment asset. Throws a
 * `ValidationError` (HTTP 400) when the asset is not in {@link SUPPORTED_ASSETS}.
 *
 * @param asset  the asset code to validate
 * @param label  optional human-readable field name used in the error message
 */
export function validateSupportedAsset(asset: string, label = 'asset'): void {
  if (!SUPPORTED_ASSETS.includes(asset.toUpperCase() as SupportedAsset)) {
    throw new ValidationError(
      `${label} is not supported. Supported assets: ${SUPPORTED_ASSETS.join(', ')}.`,
      { asset },
    );
  }
}

/**
 * Validate that `address` is a syntactically valid Stellar public key. Throws a
 * `ValidationError` (HTTP 400) when the address does not match the canonical
 * Stellar ed25519 account-ID format.
 *
 * @param address  the address to validate
 * @param label    optional human-readable field name used in the error message
 */
export function validateStellarAddress(address: string, label = 'address'): void {
  if (typeof address !== 'string' || !STELLAR_PUBLIC_KEY_REGEX.test(address)) {
    throw new ValidationError(`${label} must be a valid Stellar public key (G... format).`, {
      [label]: typeof address === 'string' ? address : undefined,
    });
  }
}

/**
 * Maximum length for a commitment id route parameter. Bounds the value before
 * it is used as a lookup key or interpolated, protecting against oversized
 * hostile input.
 */
export const MAX_COMMITMENT_ID_LENGTH = 128;

/**
 * Validate a commitment identifier supplied via a route parameter.
 *
 * Rejects empty values, oversized values, and path-traversal / control
 * characters. This is deliberately permissive about the concrete id charset
 * (the chain may use different encodings) while still enforcing a hard
 * hostile-input boundary before the value reaches a chain lookup.
 *
 * @param id   the route param value (may be `undefined` for a missing param)
 * @param label  optional human-readable field name used in the error message
 */
export function validateCommitmentId(id: string | undefined, label = 'commitment id'): string {
  if (typeof id !== 'string' || id.length === 0) {
    throw new ValidationError(`${label} is required.`, { [label]: undefined });
  }
  if (id.length > MAX_COMMITMENT_ID_LENGTH) {
    throw new ValidationError(`${label} is too long.`, { maxLength: MAX_COMMITMENT_ID_LENGTH });
  }
  if (id !== id.trim() || /[\\/.\0-\x1f\x7f]/.test(id)) {
    throw new ValidationError(`${label} contains disallowed characters.`);
  }
  return id;
}
