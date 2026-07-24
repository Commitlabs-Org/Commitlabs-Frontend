# SEO & Metadata Conventions

## Overview

CommitLabs uses **Next.js 14 App Router metadata API** for per-route SEO metadata (title,
description, Open Graph, and Twitter cards).

> **Web App Manifest:** installability metadata (name, icons, theme color) is served
> by the App Router metadata route [`src/app/manifest.ts`](../src/app/manifest.ts) at
> `/manifest.webmanifest`. Its `theme_color`/`background_color` track the
> `--surface-base` design token (`#0a0a0a`), and its icon (`public/icon.svg`) is a
> neutral placeholder intended to be replaced by final brand artwork. See the
> [Web App Manifest](#web-app-manifest) section below.

Since route pages that require client-side interactivity use `'use client'` (and therefore
cannot export `metadata` directly), each such route **must have a sibling `layout.tsx`**
that is a **server component** and exports the metadata.

## Convention

### Page type → Metadata location

| Page type | Where metadata lives | Example |
|-----------|---------------------|---------|
| Server component (`page.tsx` without `'use client'`) | `export const metadata` in `page.tsx` | Root landing page |
| Client component (`page.tsx` with `'use client'`) | `export const metadata` in sibling `layout.tsx` | Marketplace, Commitments, Create, Settings |

### Required fields

Every route **should** export a `Metadata` object with:

```ts
export const metadata: Metadata = {
  title: 'Page Title — CommitLabs',
  description: 'A clear, concise one- to two-sentence description of the page content.',
  openGraph: {
    title: 'Page Title — CommitLabs',
    description: 'Same as description, or a shorter variant for social cards.',
    url: 'https://commitlabs.com/<route>',
    siteName: 'CommitLabs',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: '...' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Page Title — CommitLabs',
    description: 'Short description for Twitter cards.',
    images: ['/og-image.jpg'],
  },
}
```

### Metadata defaults

The root `src/app/layout.tsx` defines baseline metadata that applies to every page.
Route-level metadata **overrides** the root `title` and `description` for that route,
but inherits any fields not explicitly set (e.g. `robots`, `verification`).

> **Note:** The `google-site-verification` tag is driven by the `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`
> environment variable. If this variable is unset or empty, the verification tag is entirely omitted
> from the DOM.

### Dynamic routes

For dynamic routes like `/commitments/[id]`, use `generateMetadata`. Because the page itself
is a client component (`'use client'`), place `generateMetadata` in the sibling
`layout.tsx` server component:

```ts
// src/app/commitments/[id]/layout.tsx
import type { Metadata } from 'next'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = params.id
  const title = `Commitment #${id} — CommitLabs`
  const description = `View performance metrics, compliance scores, and activity for commitment #${id} on CommitLabs.`
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://commitlabs.com/commitments/${id}`,
      siteName: 'CommitLabs',
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: title }],
      locale: 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/og-image.jpg'],
    },
  }
}

export default function CommitmentDetailLayout({ children }: { children: React.ReactNode }) {
  return children
}
```

The page **must** be a server component (or wrapped in a server-component layout) to use
`generateMetadata`.

### Implemented per-route metadata

| Route | File | Metadata type | Notes |
|-------|------|--------------|-------|
| `/commitments/[id]` | `src/app/commitments/[id]/layout.tsx` | `generateMetadata` | Derives title/OG from `params.id`; safe fallback for unknown ids |
| `/marketplace` | `src/app/marketplace/layout.tsx` | `export const metadata` | Static; full OG + Twitter card |

## Sitemap

The sitemap at `src/app/sitemap.ts` enumerates **public routes only**.

### Public routes (indexed)

| Route | Priority | Change frequency | Notes |
|-------|----------|-----------------|-------|
| `/` | 1.0 | yearly | Landing page |
| `/marketplace` | 0.8 | weekly | Public marketplace browsing |
| `/transaction-error` | 0.1 | monthly | Transaction error page |
| `/network-error` | 0.1 | monthly | Network error page |

### Private / wallet-gated routes (excluded from sitemap)

| Route | Reason |
|-------|--------|
| `/create` | Requires wallet connection |
| `/commitments` | Requires wallet connection |
| `/commitments/[id]` | Requires wallet connection |
| `/commitments/overview` | Requires wallet connection |
| `/settings` | Requires wallet connection |

## Robots.txt

The `src/app/robots.ts` file provides a dynamic `robots.txt` generated via a typed route. It returns a `MetadataRoute.Robots` object with generic allow rules and a `sitemap` reference that matches the dynamic sitemap URL.

```ts
import type { MetadataRoute } from 'next'

const BASE_URL = 'https://commitlabs.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
```

This ensures that search engine crawlers receive up‑to‑date rules and a sitemap location that reflects the current deployment environment.

### Adding a new public route

1. Add the route entry in `src/app/sitemap.ts`.
2. If the page is a client component, create a sibling `layout.tsx` with metadata.
3. Update `PUBLIC_ROUTES` in `src/app/sitemap.test.ts`.
4. Run `pnpm test` to verify.

## Testing

- `src/app/sitemap.test.ts` asserts that all public routes are present, all private routes
  are absent, entries have valid structure, and there are no duplicates.
- When a new public route is added, the **drift detection test** will fail until
  `PUBLIC_ROUTES` in the test file is updated.

## Web App Manifest

The web app manifest makes CommitLabs installable as a PWA with consistent
naming, icons, and colors across platforms. It is implemented as an App Router
metadata route — [`src/app/manifest.ts`](../src/app/manifest.ts) — which Next.js
serves at `/manifest.webmanifest` and links automatically from the document head.

Key fields:

- `name` / `short_name` / `description` — mirror the site metadata in
  `src/app/layout.tsx`.
- `start_url` `'/'` and `scope` `'/'` — the app launches at and is scoped to the
  site root.
- `display: 'standalone'` — installed app runs without browser chrome.
- `theme_color` / `background_color` — `#0a0a0a`, kept in sync with the
  `--surface-base` design token in `src/app/globals.css`.
- `icons` — reference `public/icon.svg` (scalable, `purpose: any` and
  `maskable`). This SVG is a **neutral placeholder**; replace it with final brand
  artwork (and add raster `192x192` / `512x512` PNGs if broader launcher support
  is required) without changing the manifest contract.

### Testing

[`src/app/__tests__/manifest.test.ts`](../src/app/__tests__/manifest.test.ts)
asserts the required installability fields, that the colors match the design
token, that a maskable icon is declared, and that **every referenced icon asset
actually exists** in `public/` — so a manifest that points at a missing icon
fails CI.
