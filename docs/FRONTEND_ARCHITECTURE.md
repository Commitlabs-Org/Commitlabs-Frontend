# Frontend Architecture

## Routes & Page Components

| Route | Page File | Components | API Routes Consumed |
|-------|-----------|------------|-------------------|
| `/` | `src/app/page.tsx` | `Navigation`, `HeroSection`, `ProblemSection`, `SolutionSection`, `CoreConceptsSection`, `CommitmentJourney`, `ImpactSection`, `ExperienceSection`, `Footer`, `ModalTester`, `ScrollToTopButton` | — (static) |
| `/create` | `src/app/create/page.tsx` | `CreateCommitmentStepSelectType`, `CreateCommitmentStepConfigure`, `CreateCommitmentStepReview`, `CommitmentCreatedModal`, `WizardStepper` | `POST /api/commitments`, `GET /api/config/supported` |
| `/marketplace` | `src/app/marketplace/page.tsx` | `MarketplaceHeader`, `MarketplaceFilters`, `MarketplaceGrid`, `MarketplaceGridSkeleton`, `MarketplaceResultsLayout`, `TrustBadge` | `GET /api/marketplace`, `GET /api/marketplace/listings`, `GET /api/marketplace/featured`, `GET /api/marketplace/stats` |
| `/commitments` | `src/app/commitments/page.tsx` | `MyCommitmentsHeader`, `MyCommitmentsStats`, `MyCommitmentsFilters`, `MyCommitmentsGrid`, `MyCommitmentsGridSkeleton`, `CommitmentEarlyExitModal`, `ExportCommitmentsModal` | `GET /api/commitments`, `GET /api/commitments/[id]/early-exit`, `GET /api/commitments/export`, `GET /api/protocol/constants` |
| `/commitments/[id]` | `src/app/commitments/[id]/page.tsx` | `CommitmentDetailParameters`, `CommitmentHealthMetrics`, `RecentAttestationsPanel`, `CommitmentDetailAllocationConstraints`, `CommitmentDetailNftSection` | `GET /api/commitments/[id]`, `GET /api/attestations/recent`, `GET /api/commitments/[id]/history` |
| `/commitments/overview` | `src/app/commitments/overview/page.tsx` | `CommitmentDetailOverview` | `GET /api/commitments/[id]` |
| `/settings` | `src/app/settings/page.tsx` | `Navigation`, `NotificationSection`, `NotificationToggle`, `Footer` | `GET /api/user/preferences`, `PUT /api/user/preferences` |
| `/network-error` | `src/app/network-error/page.tsx` | `ErrorLayout`, `ErrorButton` | — (client-only) |
| `/transaction-error` | `src/app/transaction-error/page.tsx` | `ErrorLayout`, `ErrorButton` | — (client-only via search params) |

### Error pages

| Route | File | Description |
|-------|------|-------------|
| `error.tsx` (500) | `src/app/error.tsx` | Global error boundary; uses `ErrorLayout` + `ErrorButton` |
| `not-found.tsx` (404) | `src/app/not-found.tsx` | Unknown-route fallback; uses `ErrorLayout` + `ErrorButton` |
| `/network-error` | `src/app/network-error/page.tsx` | Dedicated connectivity-error page with retry + checklist |
| `/transaction-error` | `src/app/transaction-error/page.tsx` | Parameterised page (`?code=`, `?hash=`, `?category=`) handling rejected / timed-out / failed tx flows |

---

## API Route Tree

All API routes are served by the Next.js App Router under `src/app/api/`.

```
api/
├── admin/audit-events/        GET  — List audit events
├── analytics/user/            GET  — User analytics
├── attestations/              GET  — List attestations
│   └── recent/                GET  — Recent attestations
├── auth/                      POST — Authenticate session
│   ├── csrf/                  GET  — CSRF token
│   ├── nonce/                 POST — Request signing nonce
│   ├── verify/                POST — Verify wallet signature
│   └── logout/                POST — Revoke session
├── commitments/               GET  — List user commitments
│   │                          POST — Create commitment
│   ├── [id]/                  GET  — Commitment detail
│   │   ├── dispute/           POST — Dispute commitment
│   │   ├── early-exit/        POST — Execute early exit
│   │   ├── events/            GET  — Commitment events
│   │   ├── fund/              POST — Fund commitment
│   │   ├── history/           GET  — Value / compliance history
│   │   ├── resolve/           POST — Resolve dispute
│   │   ├── settle/            POST — Settle commitment
│   │   └── status/            GET  — Current status
│   ├── export/                GET  — Export commitments as CSV
│   ├── search/                GET  — Search commitments
│   └── validate/              POST — Validate commitment params
├── config/supported/          GET  — Supported assets / params
├── health/                    GET  — Health check
├── login/                     POST — Login with session token
├── marketplace/               GET  — List marketplace listings
│   │                          POST — Create listing
│   ├── featured/              GET  — Featured listings
│   ├── listings/              GET  — All listings
│   │   └── [id]/              GET  — Listing detail
│   └── stats/                 GET  — Marketplace stats
├── metrics/                   GET  — Protocol metrics
├── notifications/             GET  — User notifications
├── protocol/constants/        GET  — Protocol constants (penalties etc.)
├── ready/                     GET  — Readiness check
├── seed/                      POST — Seed mock data
└── user/preferences/          GET  — User preferences
                               PUT  — Update preferences
```

### Backend patterns

- Every Route handler wraps business logic in `withApiHandler()` (`src/lib/backend/withApiHandler.ts`) which provides CORS enforcement, ETag support, request correlation IDs, and error serialisation.
- `src/lib/backend/cors.ts` defines `CorsRoutePolicy` objects that gate endpoints as `first-party` or `public`.
- Rate limiting is applied per-IP via `checkRateLimit()` (`src/lib/backend/rateLimit.ts`).
- Validation uses `zod` schemas at the top of each route handler.
- API responses use helper functions `ok()`, `fail()`, and `attachSecurityHeaders()` from `src/lib/backend/apiResponse.ts`.
- **Module Map / Canonical Utilities**: The `src/lib/backend/` directory is the single canonical source of truth for all API-related utilities and handlers. To prevent duplication and drift, backend utilities should not be placed or duplicated in `src/utils/`.

---

## Fonts & typography

Fonts are loaded via `next/font/google` in `src/app/layout.tsx` to avoid render-blocking `@import` of remote Google Fonts stylesheets.

- `Inter` and `Roboto Mono` are self-hosted and configured with `display: swap`.
- Tailwind’s font theme uses the existing `--font-roboto` CSS variable.

## Image Conventions

- Raster assets (PNG, JPG, WebP) should always be rendered using `next/image` rather than raw HTML `<img>` tags or CSS `background-image` attributes.
- Use explicit `width` and `height` properties or the `fill` layout with an explicit container size to prevent Cumulative Layout Shift (CLS).
- Always provide descriptive `alt` text for accessibility, or an empty string `alt=""` for purely decorative images.
- Remote images (e.g., from IPFS gateways) are configured under `images.remotePatterns` in `next.config.js`.

## Wallet & Auth State Flow


### Auth flow

```
1. User clicks "Connect Wallet"
2. POST /api/auth/nonce  ← { address }              →  { nonce, message }
3. Wallet signs message (via Freighter API)
4. POST /api/auth/verify ← { address, signature, message } → { sessionToken }
5. sessionToken stored in HttpOnly cookie (cl_session)
```

### `useWallet` hook (`src/hooks/useWallet.ts`)

- Calls `getAddress()` from `@stellar/freighter-api` on mount.
- Exposes `{ connected, address, connect, disconnect, error, connecting }`.
- Used by: `WalletConnectButton`, `MyCommitments` page, modals that need the owner address.

### Token / session storage

| Storage | What | Purpose |
|---------|------|---------|
| **HttpOnly cookie** (`cl_session`) | Opaque session ID | Server-side session tracking (CSRF + wallet binding) |
| **Bearer token** (Authorization header) | `session_*` string | API route auth via `verifySessionToken()` / `requireAuth()` |
| **In-memory** (React state) | `address` | Client-side wallet awareness |
| **`sessionStore`** (in-memory Map in `src/lib/backend/session.ts`) | `{ csrfToken, walletAddress, createdAt }` | Server-side session store |

Key auth utilities:
- `src/lib/backend/auth.ts` — Nonce generation, Stellar signature verification, session token create/verify/revoke
- `src/lib/backend/requireAuth.ts` — `requireAuth()`, `verifyAuth()`, `requireAdmin()`, `validateCsrfToken()`
- `src/lib/backend/session.ts` — Browser session creation, CSRF token rotation

---

## Modal & Overlay Conventions

| Modal Component | File | Triggered By |
|-----------------|------|-------------|
| `TransactionProgressModal` | `src/app/TransactionProgressModal.tsx` | Any wallet action; 5 states: `IDLE → AWAITING_SIGNATURE → SUBMITTING → PROCESSING → SUCCESS | ERROR` |
| `CommitmentCreatedModal` | `src/components/modals/CommitmentCreatedModal.tsx` | After commitment creation success |
| `CommitmentDetailsModal` | `src/components/modals/CommitmentDetailsModal.tsx` | Marketplace card "Details" click |
| `CommitmentEarlyExitModal` | `src/components/CommitmentEarlyExitModal/` | "Early Exit" button on commitment cards |
| `SettlementModal` | `src/components/modals/SettlementModal.tsx` | Settlement actions |
| `ExportCommitmentsModal` | `src/components/export/ExportCommitmentsModal.tsx` | "Export" button on commitments page |
| `ModalTester` (dev only) | `src/app/ModalTester.tsx` | Floating test buttons on landing page |

### Modal patterns
- Modals are rendered conditionally at the page level (not via a global portal).
- `TransactionProgressModal` handles the full lifecycle of any blockchain transaction with mapped error codes (`USER_REJECTED`, `RPC_TIMEOUT`, `SLIPPAGE_EXCEEDED`, `CONTRACT_REVERTED`, `INSUFFICIENT_BALANCE`, `NETWORK_CONGESTION`, `UNKNOWN_ERROR`).
- Error modals show primary/secondary action buttons based on error category.

---

## Component Tree by Page

### Landing (`/`)
```
Navigation
HeroSection
ProblemSection
SolutionSection
CoreConceptsSection
CommitmentJourney  →  src/components/CommitmentJourney/
ImpactSection
ExperienceSection
Footer
ScrollToTopButton  (layout.tsx)
ModalTester  (dev only, renders TransactionProgressModal)
```

### Create (`/create`)
```
WizardStepper
├── Step 1: CreateCommitmentStepSelectType
├── Step 2: CreateCommitmentStepConfigure
└── Step 3: CreateCommitmentStepReview
              └── CommitmentCreatedModal (on submit)
```

### Marketplace (`/marketplace`)
```
MarketplaceHeader
MarketplaceFilters
├── MarketplaceGrid
│   └── MarketplaceCard (per item)
└── MarketplaceResultsLayout  (pagination, view toggle)
MarketplaceGridSkeleton  (loading)
TrustBadge
```

### My Commitments (`/commitments`)
```
MyCommitmentsHeader
MyCommitmentsStats
├── KPICard  (per stat)
MyCommitmentsFilters
├── MyCommitmentsGrid
│   └── MyCommitmentCard (per commitment)
└── MyCommitmentCard → CommitmentEarlyExitModal
MyCommitmentsGridSkeleton  (loading)
ExportCommitmentsModal
```

### Commitment Detail (`/commitments/[id]`)
```
CommitmentDetailParameters
CommitmentHealthMetrics
├── HealthMetricsComplianceChart
├── HealthMetricsDrawdownChart
├── HealthMetricsValueHistoryChart
├── HealthMetricsFeeGenerationChart
└── HealthMetricsSkeleton
RecentAttestationsPanel
CommitmentDetailAllocationConstraints
CommitmentDetailNftSection
CommitmentDetailActions
```

### Settings (`/settings`)
```
Navigation
NotificationSection (×3: Violations, Expiry, Marketplace)
└── NotificationToggle (per preference)
Footer
```

---

## Data Flow Conventions

1. **Page-level data fetching**: Pages fetch data in `useEffect` and store results in local `useState`. There is no global state library (no Redux, no Zustand); state is hoisted only as far as needed via props.

2. **Mock data fallback**: Most pages include inline mock data (e.g. `mockListings`, `mockCommitments`) and a simulated loading delay. When `NEXT_PUBLIC_USE_MOCKS=true`, the commitments page calls `listCommitments()` from `src/lib/backend/mocks/contracts.ts` instead.

3. **Soroban contract calls**: `src/lib/backend/services/contracts.ts` exposes `getUserCommitmentsFromChain`, `getCommitmentFromChain`, and `createCommitmentOnChain`. Contract addresses are loaded from `src/utils/soroban.ts`.

4. **Protocol constants**: Fetched via `fetchProtocolConstants()` from `src/utils/protocol.ts` (calls `GET /api/protocol/constants`) — currently used for early-exit penalty tiers.

5. **Preferences**: `src/lib/backend/preferences.ts` provides a JSON-file-backed store for notification preferences, served through `GET/PUT /api/user/preferences`.

---

## Shared Components

Component file convention: shared React components in `src/` should use TypeScript (`.ts`/`.tsx`) rather than untyped `.jsx` files.

### Foldered Component Convention

For components with associated styles, tests, or sub-components, use a foldered structure:
```
src/components/
└── ComponentName/
    ├── ComponentName.tsx  # Primary component implementation
    ├── ComponentName.module.css  # Styles (if using CSS Modules)
    ├── ComponentName.test.tsx  # Tests
    ├── SubComponent.tsx  # Sub-components used only by this component
    └── index.ts  # Optional: Export the component for easier imports
```

This convention keeps related files grouped together, making the codebase more organized and maintainable.

| Component | File | Usage |
|-----------|------|-------|
| `EmptyState` | `src/components/ui/EmptyState.tsx` | Shared empty-state primitive used by `MyCommitmentsGrid`, `MarketplaceGrid`, `RecentAttestationsPanel`; accepts `title`, `description`, `icon`, `cta` (href or onClick) |
| `ErrorLayout` | `src/components/ErrorLayout.tsx` | 500, 404, network-error, transaction-error pages |
| `ErrorButton` | `src/components/ErrorButton.tsx` | Buttons on all error pages (supports `href`, `onClick`, `isExternal`) |
| `Skeleton` | `src/components/Skeleton.tsx` | Generic shimmer placeholder |
| `WalletConnectButton` | `src/components/WalletConnectButton.tsx` | Connect/disconnect wallet; uses `useWallet` |
| `TrustBadge` | `src/components/TrustBadge.tsx` | Verified/reputable/unverified badge |
| `NFTDisplay` | `src/components/NFTDisplay.tsx` | NFT metadata display |
| `ReputationDisplay` | `src/components/ReputationDisplay.tsx` | User reputation score |
| `KPICard` | `src/components/KPICard/` | Stat card (label + value) |
| `VolatilityExposureMeter` | `src/components/VolatilityExposureMeter/` | Volatility indicator |
| `ComparisonPanel` | `src/components/ComparisonPanel.tsx` | Side-by-side commitment comparison |
| `BenefitCard` | `src/components/BenefitCard.tsx` | Feature card for landing page |
| `WizardStepper` | `src/components/WizardStepper.tsx` | Step indicator for create wizard |

---

## Error Handling Strategy

- `error.tsx` (500) at `src/app/error.tsx` — Global Next.js error boundary; shows error code, message, digest, retry/home/report buttons.
- `not-found.tsx` (404) at `src/app/not-found.tsx` — Custom 404 with search bar and back/home navigation.
- `/network-error` — Standalone connectivity-error page; checks connectivity via `HEAD /` before retry.
- `/transaction-error` — Centralised page for blockchain transaction failures. Accepts `?code=`, `?hash=`, `?category=` search params. Contains recovery tips per category (rejected / timed-out / failed).
- `TransactionProgressModal` — Inline modal for real-time tx progress with mapped user-facing error messages.

---

## Key Source File Index

| Concern | File |
|---------|------|
| Wallet hook | `src/hooks/useWallet.ts` |
| Soroban contract config | `src/utils/soroban.ts` |
| Stellar explorer links | `src/utils/explorerLinks.ts` |
| Protocol constants fetcher | `src/utils/protocol.ts` |
| Auth (nonce, session tokens) | `src/lib/backend/auth.ts` |
| Auth middleware | `src/lib/backend/requireAuth.ts` |
| Browser session + CSRF | `src/lib/backend/session.ts` |
| API response helpers | `src/lib/backend/apiResponse.ts` |
| CORS policy | `src/lib/backend/cors.ts` |
| Rate limiting | `src/lib/backend/rateLimit.ts` |
| Error types | `src/lib/backend/errors.ts` |
| Contract service layer | `src/lib/backend/services/contracts.ts` |
| Mock data (commitments) | `src/lib/backend/mocks/contracts.ts` |
| Mock data (marketplace) | `src/lib/backend/mocks/marketplace.ts` |
| User preferences | `src/lib/backend/preferences.ts` |
| Commitments API routes | `src/app/api/commitments/route.ts` |
| Marketplace API routes | `src/app/api/marketplace/route.ts` |
| Auth API routes | `src/app/api/auth/*/route.ts` |
| Notification preferences API | `src/app/api/user/preferences/route.ts` |
| TypeScript types | `src/types/commitment.ts`, `src/types/marketplace.ts` |
| Test setup | `tests/setup/vitest.setup.ts` |

## Formatting Utilities

All numeric, currency, percentage, and date formatting is centralised in
`src/utils/format.ts`. Components must use these helpers instead of
inline `toLocaleString`, `toFixed`, or manual string construction.

### Available helpers

| Helper | Signature | Example output |
|--------|-----------|----------------|
| `formatNumber` | `(value, options?) → string` | `"1,234,567"` |
| `formatCurrency` | `(value, options?) → string` | `"$9,500.00"` |
| `formatPercent` | `(value, options?) → string` | `"12.3%"` |
| `formatDate` | `(value, options?) → string` | `"Jun 29, 2026"` |

### Fallback behaviour

All helpers return `"--"` when passed `null`, `undefined`, `NaN`, or `Infinity`. Call sites never need to guard against bad input.

### Options

- **`formatNumber`**: `decimals` (default 0), `locale` (default `"en-US"`), `compact` (default `false`)
- **`formatCurrency`**: `currency` (default `"USD"`), `decimals` (default 2), `locale`, `compact`
- **`formatPercent`**: `decimals` (default 1), `isDecimal`, `showSign`, `locale`
- **`formatDate`**: `style` (`"short"` | `"medium"` | `"long"` | `"full"`), `includeTime`, `locale`

### Migrated components

- `src/components/KPICard/KPICard.tsx` — uses `formatNumber`, `formatCurrency`, `formatPercent`
- `src/components/MarketplaceCard.tsx` — uses `formatPercent`