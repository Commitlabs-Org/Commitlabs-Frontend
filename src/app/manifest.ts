import type { MetadataRoute } from 'next'

/**
 * Web App Manifest (App Router metadata route).
 *
 * Served at `/manifest.webmanifest` and makes the app installable as a PWA with
 * a consistent name, icons, and colors across platforms. This adds metadata
 * only — it does not change runtime behaviour.
 *
 * `theme_color`/`background_color` are kept in sync with the design token
 * `--surface-base` (`#0a0a0a`) defined in `src/app/globals.css`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CommitLabs - Liquidity as a Commitment',
    short_name: 'CommitLabs',
    description:
      'Transform passive liquidity into enforceable, attestable, and composable on-chain commitments',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        type: 'image/svg+xml',
        sizes: 'any',
        purpose: 'maskable',
      },
    ],
  }
}
