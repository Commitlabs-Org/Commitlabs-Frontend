/**
 * Small, dependency-free formatting helpers shared across the app.
 *
 * This module deliberately imports nothing (in particular, nothing from the
 * Soroban SDK) so that both server components and client components can use it
 * without pulling the SDK into their bundle.
 */

/**
 * Shorten a Stellar address (or any long identifier) to `first4...last4`.
 * Strings shorter than 9 characters are already readable and are returned as-is.
 */
export function shortAddress(address: string): string {
  if (!address || address.length < 9) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}
