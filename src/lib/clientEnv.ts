/**
 * Client-side environment configuration.
 *
 * Only exposes values that are safe for the browser bundle.
 * Secrets and server-only keys must never appear here.
 */

export function getAppExplorerNetwork(): string {
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('commitlabs.network');
      if (stored === 'testnet' || stored === 'public') return stored;
    }
  } catch {
    // Ignore storage errors
  }
  return 'testnet';
}
