# Marketplace Listing Detail Page

This document describes the new deep-linkable marketplace listing detail page at `src/app/marketplace/[id]/page.tsx`.

## Purpose

The listing detail page provides a durable, shareable route for marketplace listings that is independent of the existing `CommitmentDetailsModal` quick-view UI.

## Routes

- `GET /marketplace/:id` — renders the new marketplace listing detail page.
- `GET /api/marketplace/listings/:id` — returns the listing payload used by the page and other marketplace clients.

## Features

- Server-rendered listing details for marketplace listings
- Trust and risk signals using `TrustBadge` and `ReputationDisplay`
- Purchase flow wiring via `/api/marketplace/listings/:id/preflight` and `/api/marketplace/listings/:id/purchase`
- Loading fallback via `src/app/marketplace/[id]/loading.tsx`
- Error boundary via `src/app/marketplace/[id]/error.tsx`
- Deep-linkable metadata for sharing and social previews

## Implementation

- `src/app/marketplace/[id]/page.tsx`
  - loads the listing server-side from `marketplaceService.getPublicListing`
  - returns `notFound()` when the listing does not exist
  - renders the marketplace detail component and purchase panel

- `src/components/MarketplaceListingDetail.tsx`
  - renders marketplace listing fields, risk indicators, and trust signals

- `src/components/MarketplaceListingPurchase.tsx`
  - client-side purchase CTA with preflight and purchase request handling

- `src/app/api/marketplace/listings/[id]/route.ts`
  - adds a public `GET` route for listing retrieval
  - retains `DELETE` for listing cancellation

## Notes

This page is intentionally separate from the quick-view modal so listings can be shared directly, bookmarked, and indexed by client-side navigation.
