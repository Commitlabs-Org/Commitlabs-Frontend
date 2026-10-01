# Changelog

All notable changes to the CommitLabs frontend are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

See [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) for how entries are added
and how releases are cut. For breaking **backend** API changes that affect this
frontend, see [`docs/backend-changelog.md`](docs/backend-changelog.md).

## [Unreleased]

### Added

- `CHANGELOG.md` and a documented release/versioning process
  (`docs/RELEASE_PROCESS.md`).

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.1.0] - 2026-07-26

### Added

#### Landing & Marketing

- Landing page with hero, problem/solution sections, commitment journey timeline, impact metrics, and experience showcase.
- `ScrollToTopButton` for long-page navigation.

#### Commitment Creation

- Three-step create commitment wizard (`/create`): type selection, configuration, and review with `WizardStepper` progress indicator.
- `CommitmentCreatedModal` displayed on successful commitment creation.
- Backend `POST /api/commitments` integration with Zod validation.
- `GET /api/config/supported` for dynamic asset and parameter support.

#### Marketplace

- Marketplace listing page (`/marketplace`) with `MarketplaceHeader`, `MarketplaceFilters`, `MarketplaceGrid`, and `MarketplaceResultsLayout`.
- Marketplace listing detail page (`/marketplace/[id]`) for deep-linkable, shareable listings with purchase flow.
- Featured listings, stats banner, and search/filter UI with pagination.
- `TrustBadge` for verified/reputable/unverified listing signals.
- `ReputationDisplay` for user reputation scores.
- Marketplace skeleton loading states.
- Empty states for zero-result and no-listing scenarios.
- Saved searches support.

#### My Commitments

- My Commitments page (`/commitments`) with `MyCommitmentsHeader`, `MyCommitmentsStats`, `MyCommitmentsFilters`, and `MyCommitmentsGrid`.
- `KPICard` stat cards for commitment overview metrics.
- Bulk actions on commitments.
- Sorting and filtering of commitment lists.
- `ExportCommitmentsModal` for CSV export of commitments.
- `CommitmentEarlyExitModal` for initiating early exits.
- Commitment detail page (`/commitments/[id]`) with parameter display, health metrics charts, recent attestations panel, allocation constraints, and NFT section.
- Commitment detail overview page (`/commitments/overview`).

#### Commitment Lifecycle

- Commitment health metrics dashboard: compliance chart, drawdown chart, value history chart, and fee generation chart.
- Attestation display with `RecentAttestationsPanel`, attestation filters, and real-time attestation updates.
- Attestation export functionality.
- Allocation constraints editor.
- Dispute flow and dispute tracker.
- Settlement eligibility checks and settlement modal.
- Early exit timing and early exit modal.
- Commitment status context display.
- Duplicate commitment detection.
- Maturity countdown and grace countdown timers.
- At-risk thresholds and at-risk widget for health warnings.

#### Wallet & Authentication

- Stellar wallet integration via Freighter (`@stellar/freighter-api`).
- `WalletConnectButton` for connect/disconnect with `useWallet` hook.
- Three-step cryptographic authentication handshake: nonce request, wallet signature, session verification.
- HttpOnly cookie session management (`cl_session`) with CSRF token rotation.
- Server-side session store with wallet address binding.
- `ROUTE_AUTH_GUARD` for protected routes.
- Network mismatch detection.
- Active sessions awareness.
- Wallet account menu.

#### Error Handling & Resilience

- Global error boundary (`error.tsx`) with `ErrorLayout` and recovery actions.
- Custom 404 page with search bar and navigation.
- Dedicated network error page (`/network-error`) with connectivity check and retry.
- Dedicated transaction error page (`/transaction-error`) with parameterised error codes, categories, and recovery tips.
- `ErrorBoundary` component with programmatic reset, custom fallback UI, and HOC support.
- `ErrorButton` for consistent error-page actions.
- Connection status indicator.

#### Transaction Experience

- `TransactionProgressModal` with four-step timeline: Build, Sign, Submit, Confirm.
- Mapped error codes (`USER_REJECTED`, `RPC_TIMEOUT`, `SLIPPAGE_EXCEEDED`, `CONTRACT_REVERTED`, `INSUFFICIENT_BALANCE`, `NETWORK_CONGESTION`, `UNKNOWN_ERROR`) with user-facing messages.
- Transaction hash display with copy action on failure.
- Transaction persistence.
- Elapsed-time indicator with `prefers-reduced-motion` support.
- Live region announcements for assistive technology.

#### Notifications & Toasts

- Notifications center with durable inbox, category filtering (Expiry, Violations, Health, Marketplace), and read/unread state.
- Global toast notification system (`ToastProvider`) with success, error, info, and warning types.
- Toast action buttons and toast history.
- User notification preferences with toggle controls per category (Violations, Expiry, Marketplace) persisted via `GET/PUT /api/user/preferences`.

#### Settings & Preferences

- Settings page (`/settings`) with notification preference toggles.
- Unsaved changes guard on settings form.

#### UI & Design System

- Dark/light/system theme toggle powered by `next-themes` with CSS custom properties and Tailwind v4 `@theme` tokens.
- `Skeleton` shimmer loading placeholders for all data-fetching pages.
- `ModalTester` for development-time modal testing.
- `ModalSystem` architecture for consistent modal rendering.
- Shared `EmptyState` component with title, description, icon, and CTA.
- `ComparisonPanel` for side-by-side commitment comparison.
- `VolatilityExposureMeter` for volatility exposure indication.
- `BenefitCard` for landing-page feature highlights.
- `NFTDisplay` with action controls for NFT metadata.
- `SKIP_LINK` for keyboard accessibility.
- `HelpDrawer` for in-app contextual help.
- Sidebar search for navigation.
- Recently viewed items tracking.
- Share link functionality for commitments.
- Chart export capability.
- `OVERVIEW_WIDGETS` with activity feed and time range selector.
- `MARKETPLACE_COMPARE` for listing comparison.
- `DETAIL_HEADER_COPY` for commitment detail header.
- `EXPORT_COLUMNS` configuration for CSV export.

#### API & Backend

- Backend API layer (`src/lib/backend/`) with `withApiHandler` wrapper providing CORS, ETag, correlation IDs, and error serialisation.
- `CorsRoutePolicy` for first-party vs public endpoint gating.
- Rate limiting per-IP via `checkRateLimit`.
- Zod validation at API route boundaries.
- Standardised API response helpers (`ok()`, `fail()`, `attachSecurityHeaders()`).
- Session-based authentication with nonce generation, Stellar signature verification, and session token lifecycle.
- Backend API reference documentation.
- Unified API response contract.
- Backend changelog process for tracking breaking API changes.

#### Performance & Quality

- Bundle analysis via `@next/bundle-analyzer` (`pnpm analyze`).
- Bundle size budget enforcement via `size-limit`.
- Dead code detection via `knip`.
- Circular dependency detection via `madge`.
- Centralised formatting utilities (`formatNumber`, `formatCurrency`, `formatPercent`, `formatDate`) with safe fallbacks.

#### Testing & CI

- Vitest unit and component testing with React Testing Library and happy-dom.
- 95% code coverage threshold (statements, branches, functions, lines).
- Playwright end-to-end testing.
- Husky pre-commit hooks with lint-staged (ESLint + TypeScript typecheck).
- Commitlint with conventional commit enforcement.
- CI pipeline with lint, typecheck, test, and build stages.

#### Documentation

- Frontend architecture documentation with route table, API tree, component hierarchy, and data flow conventions.
- Backend API reference and response format documentation.
- Backend security checklist, threat model, rate limiting, and CORS policy documentation.
- Backend session and CSRF implementation guide.
- Backend error codes and storage documentation.
- Accessibility dense UI guide, skip link, and PR-level a11y checks.
- Performance budget and skeleton loading pattern documentation.
- SEO metadata conventions.
- i18n internationalization support.
- Design tokens and design system documentation.
- Testing guide with patterns for component, API, and utility tests.
- Code of conduct, contributing hooks, and commit convention documentation.
- ADR (Architecture Decision Records) directory.
- Observability and audit documentation.

#### Security

- Centralised security headers in `withApiHandler`'s `finalizeResponse`.
- CORS enforcement on all API routes.
- CSRF token validation on state-changing requests.
- Rate limiting per-IP on API endpoints.
- HttpOnly cookie session storage.
- Wallet signature-based authentication (no client-held tokens).
- Backend security scanning and security checklist documentation.

[Unreleased]: https://github.com/Commitlabs-Org/Commitlabs-Frontend/commits/master
[0.1.0]: https://github.com/Commitlabs-Org/Commitlabs-Frontend/releases/tag/v0.1.0
