# PR Documentation: Marketplace Listing Detail Page

## Summary

This PR adds a deep-linkable marketplace listing detail page at `/marketplace/[id]`.
The page renders server-side listing data, supports rich metadata, and wires the purchase flow through the public marketplace API.

## What changed

- Added server route: `src/app/marketplace/[id]/page.tsx`
- Added route-level loading fallback: `src/app/marketplace/[id]/loading.tsx`
- Added route-level error boundary: `src/app/marketplace/[id]/error.tsx`
- Added marketplace listing detail component: `src/components/MarketplaceListingDetail.tsx`
- Added client-side purchase widget: `src/components/MarketplaceListingPurchase.tsx`
- Added public GET API route for listings: `src/app/api/marketplace/listings/[id]/route.ts`
- Expanded marketplace service: `src/lib/backend/services/marketplace.ts`
- Added listing detail page documentation: `docs/MARKETPLACE_LISTING_PAGE.md`
- Added API docs update: `docs/backend-api-reference.md`
- Added CORS policy update: `docs/backend-cors-policy.md`

## Why this matters

- Users can now share and bookmark individual marketplace listings.
- The page is server-rendered for better SEO and metadata previews.
- The purchase flow is wired consistently with existing marketplace endpoints.
- The new public GET endpoint enables marketplace clients to fetch a single listing by ID.

## How to verify

1. Run the new page test file:
   - `./node_modules/.bin/vitest run src/app/marketplace/[id]/page.test.tsx`
2. Confirm the test output includes:
   - `4 tests passed`
3. Review the new docs and API reference changes.

## Notes

- No backend breaking contract changes were introduced beyond the addition of a new public GET endpoint.
- The listing detail page uses existing marketplace models and service lookup logic.
- The purchase panel depends on wallet connection and `/api/marketplace/listings/[id]/preflight`.
