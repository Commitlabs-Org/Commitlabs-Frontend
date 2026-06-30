# CommitLabs Documentation Index

Welcome to the CommitLabs documentation index. This document serves as a single entry point for all project guides, specifications, visual layouts, and implementation details.

---

## 📖 Overview & General Guides
- **[README.md](../README.md)** (Root) — Main project overview, features, configuration guide, and quick start instructions.
- **[DEVELOPER_GUIDE.md](../DEVELOPER_GUIDE.md)** (Root) — Coding standards, TypeScript conventions, styling practices, package management, and testing workflows.
- **[CHANGELOG.md](../CHANGELOG.md)** (Root) — Keep-a-Changelog record of notable frontend changes.
- **[RELEASE_PROCESS.md](RELEASE_PROCESS.md)** — Semantic versioning, how changelog entries are added, and how releases are cut.
- **[CI.md](CI.md)** — CI workflows (coverage, Lighthouse, CodeQL, contracts, typecheck) and how to run their checks locally.
- **[GLOSSARY.md](GLOSSARY.md)** — Explanations of core business domain terms (e.g., Safe, Balanced, Aggressive commitments, drawdowns).
- **[todo/TODO.md](todo/TODO.md)** — Tracked checklist for self-hosting fonts performance feature.

## 🏗 Architecture & Design Systems
- **[adr/README.md](adr/README.md)** — Architecture Decision Records: the *why* behind cross-cutting decisions, plus the template and process for adding new ones.
- **[ARCHITECTURE.md](../ARCHITECTURE.md)** (Root) — Global system design, modules, and soroban contract data flow.
- **[FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)** — Page routes mapping to React components and API routes, including wallet/auth state design.
- **[CIRCULAR_DEPS.md](CIRCULAR_DEPS.md)** — Circular-dependency check with madge: config, the blocking CI gate, and how to break a reported cycle.
- **[MODAL_SYSTEM.md](MODAL_SYSTEM.md)** — Architecture of the modal managers, custom context triggers, and backdrop animations.
- **[TOAST_SYSTEM.md](TOAST_SYSTEM.md)** — Toast notification service, status emitters, and action triggers.

## 🚀 Features & User Flows
- **[settlement-and-early-exit-flows.md](settlement-and-early-exit-flows.md)** — Eligibility calculations, exit premiums, smart contract validations, and confirmation modal states.
- **[create-review-design.md](create-review-design.md)** — Layout and wizard states of the commitment creation flows.
- **[success-state-ux.md](success-state-ux.md)** — Visual design parameters and user flows for transaction success feedback states.
- **[skeleton-loading-patterns.md](skeleton-loading-patterns.md)** — Skeleton loading state design rules and implementation patterns.
- **[i18n.md](i18n.md)** — Multi-language internationalization structure, namespaces, and translation loading.
- **[CREATE_DRAFT_AUTOSAVE.md](CREATE_DRAFT_AUTOSAVE.md)** — Design of local storage persistence and draft restore mechanism for forms.
- **[CREATE_DRAFT_VALIDATION.md](CREATE_DRAFT_VALIDATION.md)** — Inline form field validation rules for new commitments.
- **[CREATE_THEN_FUND.md](CREATE_THEN_FUND.md)** — Multi-step sequence of creating a commitment on-chain followed by depositing assets.
- **[CREATE_WIZARD_TOUR.md](CREATE_WIZARD_TOUR.md)** — Interactive onboarding wizard guide for new users.
- **[EARLY_EXIT_TIMING.md](EARLY_EXIT_TIMING.md)** — Timing restrictions, cooldowns, and penalty formulas for exiting a commitment early.
- **[GRACE_COUNTDOWN.md](GRACE_COUNTDOWN.md)** — Early-exit grace-period countdown banner behavior, protocol constant, accessibility notes, and tests.
- **[NOTIFICATION_TEST_SEND.md](NOTIFICATION_TEST_SEND.md)** — Testing notification alerts and event trigger flows.
- **[SETTINGS_UNSAVED_GUARD.md](SETTINGS_UNSAVED_GUARD.md)** — Navigation blocks and prompt dialogs for unsaved settings forms.
- **[ROUTE_AUTH_GUARD.md](ROUTE_AUTH_GUARD.md)** — Client-side route protection and redirection for unauthenticated/disconnected wallets.
- **[SEO_METADATA.md](SEO_METADATA.md)** — Document head metadata, Open Graph tags, and page description strategies.

## 🏪 Marketplace Documentation
- **[SellerTrustGuidelines.md](SellerTrustGuidelines.md)** — Rules, scores, badges, and trust indicators for marketplace sellers.
- **[MARKETPLACE_SEARCH_UI.md](MARKETPLACE_SEARCH_UI.md)** — Search filters, sorting logic, and layout grids for listings.
- **[MARKETPLACE_COMPARE.md](MARKETPLACE_COMPARE.md)** — Side-by-side comparison tray interface for multiple listings.
- **[MARKETPLACE_EMPTY_STATES.md](MARKETPLACE_EMPTY_STATES.md)** — UI variations shown when searches or categories yield zero marketplace results.
- **[RELIST_EDIT_PRICE.md](RELIST_EDIT_PRICE.md)** — Relisting logic and price updates for existing marketplace offerings.
- **[PURCHASE_SUCCESS.md](PURCHASE_SUCCESS.md)** — UX and flow details showing post-purchase confirmation and routing.
- **[DETAIL_HEADER_COPY.md](DETAIL_HEADER_COPY.md)** — Commitment detail header copy-id and safe explorer-link actions.

## 🎨 UI/UX Design & Branding
- **[design/FigmaDesign.md](design/FigmaDesign.md)** — Figma success state designs and visual directions.
- **[design/Branding.txt](design/Branding.txt)** — Figma links and design briefs for CommitLabs logo branding assets.
- **[design/Commitlabs Branding.txt](design/Commitlabs Branding.txt)** — Reserved placeholders for brand identity assets.
- **[design/Loading State UI.txt](design/Loading State UI.txt)** — Figma links and UI specifications for the loading state components.
- **[hero-section-design.md](hero-section-design.md)** — Call-to-action layout, copy patterns, and spacing specifications for the home hero block.

## 🔒 Security, Audit & Threats
- **[security/EXTERNAL_LINKS.md](security/EXTERNAL_LINKS.md)** — External-link & subresource policy: required `rel` on `target=_blank`, the ESLint guard, the allow-listed hosts, and the safe explorer-link helper.
- **[audit/AUDIT.md](audit/AUDIT.md)** — Dead code search, TODO registry, and linting status audit documentation.
- **[DEAD_CODE_SCAN.md](DEAD_CODE_SCAN.md)** — Automated unused files/exports/deps scan with knip: config, how to read the report, and triage.
- **[backend-security-checklist.md](backend-security-checklist.md)** — API route protection, payload limits, sanitization, and compliance guidelines.
- **[backend-threat-model.md](backend-threat-model.md)** — Analysis of security vectors, Stellar transaction replay attacks, and state vulnerabilities.
- **[backend-session-csrf.md](backend-session-csrf.md)** — Anti-CSRF token handling and validation for state-modifying endpoints.

## 🧪 Testing & Verification
- **[testing/FIXTURES.md](testing/FIXTURES.md)** — Index of shared test data (factories, API helpers, mock DB/seed) and the naming conventions for adding fixtures.
- **[testing/test-auth.md](testing/test-auth.md)** — Step-by-step verification flows for wallet authentication and signature verification APIs.
- **[testing/test-settle.md](testing/test-settle.md)** — Verification procedures, payloads, and mock responses for the commitment settlement API.
- **[testing/EXPORT_MODAL_TESTS.md](testing/EXPORT_MODAL_TESTS.md)** — Testing plan for the data export/download dialog interface.
- **[testing/ERROR_PAGES_TESTS.md](testing/ERROR_PAGES_TESTS.md)** — Verification checklist for error route rendering.
- **[testing/KPICARD_TESTS.md](testing/KPICARD_TESTS.md)** — Unit test specifications for key metrics cards.
- **[testing/MARKETPLACE_CARD_TESTS.md](testing/MARKETPLACE_CARD_TESTS.md)** — Tests for listings cards.
- **[testing/RECENT_ATTESTATIONS_TESTS.md](testing/RECENT_ATTESTATIONS_TESTS.md)** — Tests verifying attestation feed components.
- **[testing/TRUST_BADGE_TESTS.md](testing/TRUST_BADGE_TESTS.md)** — Verification details for seller trust level badges.

## ♿ Accessibility & Performance
- **[accessibility/ACCESSIBILITY_STATEMENT.md](accessibility/ACCESSIBILITY_STATEMENT.md)** — Overall WCAG 2.1 AA target, current conformance posture, known gaps, and how to report accessibility problems.
- **[PERFORMANCE_BUDGET.md](PERFORMANCE_BUDGET.md)** — Core Web Vitals budget (LCP/CLS/INP), the field web-vitals reporting pipeline, and regression triage.
- **[accessibility-dense-ui.md](accessibility-dense-ui.md)** — Layout rules and size considerations for data-dense tables.
- **[accessibility/CONTRAST_AUDIT.md](accessibility/CONTRAST_AUDIT.md)** — Verification report on text color contrast ratios.
- **[accessibility/CREATE_WIZARD_A11Y.md](accessibility/CREATE_WIZARD_A11Y.md)** — Keyboard controls, screen-reader descriptions, and aria labels for form steps.
- **[accessibility/MARKETPLACE_A11Y.md](accessibility/MARKETPLACE_A11Y.md)** — Focus traps and accessible properties for comparing search items.
- **[performance/BUNDLE_BUDGET.md](performance/BUNDLE_BUDGET.md)** — Enforced client bundle-size budget with size-limit: budgets, CI gate, calibration, and regression triage.
- **[performance/GRID_RENDER.md](performance/GRID_RENDER.md)** — Virtualization, rendering limits, and performance improvements for large listing grids.
- **[performance/LAZY_HEALTH_CHARTS.md](performance/LAZY_HEALTH_CHARTS.md)** — Lazy loading strategies and performance metrics for dashboard metrics rendering.
- **[performance/LIGHTHOUSE.md](performance/LIGHTHOUSE.md)** — Lighthouse metrics checks and automated page speed scoring results.
- **[performance/STARFIELD.md](performance/STARFIELD.md)** — Canvas rendering optimizations for animated background components.

## 📡 API & Backend Storage
- **[observability/LOGGING_SCHEMA.md](observability/LOGGING_SCHEMA.md)** — Structured JSON logging contract: record shapes, levels, request-id correlation, and redaction.
- **[observability/ERROR_MONITORING.md](observability/ERROR_MONITORING.md)** — Pluggable client error-reporting seam: record shape, call sites, the adapter contract, and redaction.
- **[backend-api-reference.md](backend-api-reference.md)** — Detailed definitions of REST API routes, parameter validations, schemas, and return formats.
- **[backend-changelog.md](backend-changelog.md)** — Version logs tracking updates and contract changes to endpoints.
- **[backend-cors-policy.md](backend-cors-policy.md)** — CORS whitelist configs and cross-origin handling.
- **[backend-error-codes.md](backend-error-codes.md)** — Standardized dictionary of error identifiers returned in responses.
- **[backend-storage.md](backend-storage.md)** — Core datastore adapter configurations and local/redis backend setups.
- **[api-response-format.md](api-response-format.md)** — Structural specification of the API response JSON envelope.
- **[unified-api-response-contract.md](unified-api-response-contract.md)** — Interface contracts verifying consistent endpoints return envelope shape.
- **[session-implementation.md](session-implementation.md)** — Detailed lifecycle design of user session storage, verification, and expiration.
- **[etag/ETAG_FEATURE_README.md](etag/ETAG_FEATURE_README.md)** — ETag caching feature implementation guide.
- **[etag/ETAG_IMPLEMENTATION_SUMMARY.md](etag/ETAG_IMPLEMENTATION_SUMMARY.md)** — Summary of caching architecture and endpoints.
- **[etag/ETAG_TEST_RESULTS.md](etag/ETAG_TEST_RESULTS.md)** — Detailed test scenarios and coverage data for the ETag caching utilities.
- **[error-pages/ERROR_PAGES_README.md](error-pages/ERROR_PAGES_README.md)** — Documentation of error components and handling guides.
