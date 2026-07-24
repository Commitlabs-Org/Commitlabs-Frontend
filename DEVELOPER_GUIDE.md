# Developer Guide

Welcome to the CommitLabs Frontend developer guide. This document provides guidelines and best practices for contributing to the codebase.

## 🛠 Tech Stack

-   **Framework**: Next.js 14 (App Router)
-   **Language**: TypeScript
-   **Styling**: Tailwind CSS (v4) & CSS Modules
-   **State Management**: React Context / Hooks
-   **Blockchain**: Stellar SDK & Soroban
-   **Package Manager**: pnpm

## 💻 Coding Standards

### TypeScript

-   **Strict Mode**: We use strict TypeScript configuration. Avoid `any` whenever possible.
-   **Interfaces**: Define interfaces for all component props and data models.
-   **Types**: Use `type` for unions and simple aliases, `interface` for object shapes.
-   **Naming**:
    -   Components: `PascalCase` (e.g., `CommitmentForm.tsx`)
    -   Functions/Variables: `camelCase` (e.g., `handleSubmit`)
    -   Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRY_ATTEMPTS`)

### Backend Logging

-   A lightweight analytics logger lives in `src/lib/backend/logger.ts`.
-   Exposed helpers include `logCommitmentCreated`, `logCommitmentSettled`,
    `logEarlyExit`, and `logAttestation`.
-   Call these from API routes whenever you want to emit structured events
    relevant to business actions. This makes it easy to wire an external
    analytics platform later on.

### Request ID Correlation

-   All App Router API routes should be wrapped with `withApiHandler`.
-   `withApiHandler` will accept an incoming `x-request-id` header if present,
    otherwise it will generate a new one.
-   The resolved request id is included in structured backend logs and returned
    to the client via the `x-request-id` response header.

### Backend Breaking Change Checklist

If your change introduces a backend contract break that can impact frontend
clients, complete this checklist in the same PR:

-   [ ] Update OpenAPI docs/spec so the contract change is explicit and reviewable.
-   [ ] Add an entry to `docs/backend-changelog.md` using the template in that file.
-   [ ] Update or add contract tests that validate the new request/response shape.
-   [ ] Add UI migration notes that describe impacted pages/components and required
    frontend changes.

Treat this checklist as required for all endpoint, payload, auth, and error
shape breaking changes.

### React & Next.js

-   **Functional Components**: Use functional components with hooks.
-   **Client vs Server**: Explicitly mark Client Components with `'use client'` at the top of the file. Default to Server Components where possible for performance.
-   **Hooks**: Custom hooks should be placed in `src/hooks` (create if needed).
-   **Project Structure**:
    -   `page.tsx`: Route entry point.
    -   `layout.tsx`: Layout wrapper.
    -   `page.module.css`: Page-specific styles (if not using Tailwind utility classes).

### Styling

-   **Tailwind First**: Prefer Tailwind utility classes for layout, spacing, and typography.
-   **CSS Modules**: Use CSS Modules for complex, custom animations or specific component isolation that Tailwind handles less elegantly.
-   **Responsiveness**: Build mobile-first using Tailwind's breakpoints (`sm:`, `md:`, `lg:`).

## 🧹 Linting

The project uses ESLint with the Next.js + TypeScript ruleset.

**Configuration**: `.eslintrc.json` (ESLint v8 legacy format, compatible with `eslint-config-next`)

```json
{
  "extends": ["next/core-web-vitals", "next/typescript"],
  "rules": {
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  }
}
```

**Rules in effect:**
- `next/core-web-vitals` — Next.js recommended rules including React Hooks and import hygiene
- `next/typescript` — TypeScript-aware rules (no-unused-vars, no-explicit-any, etc.)
- Unused variables/args/caught errors prefixed with `_` are intentionally ignored (e.g. `_error`, `_token`)

**Running lint:**

```bash
pnpm lint
```

Fix all errors before committing. Warnings are informational but should be addressed where practical.

## 📚 Flow Documentation

- [Settlement and Early Exit UI Flows](docs/settlement-and-early-exit-flows.md) documents the settlement eligibility modal, settlement success state, early-exit preview/confirmation flow, related endpoints, and user-facing error reasons.
- Update that document whenever the settlement or early-exit API contracts, modal copy, or confirmation safeguards change.
## 🧪 Testing Procedures

This project uses **Vitest** for unit and integration testing, **React Testing Library** for component tests, and **happy-dom** for a lightweight test environment.

### Running Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report (95% threshold)
pnpm test:coverage
```

### Test Organization

-   **Component Tests**: Place alongside components or in `tests/components/` (suffix: `.test.tsx`)
-   **API Route Tests**: Place in `tests/api/` (suffix: `.test.ts`)
-   **Library Tests**: Place in `tests/lib/` (suffix: `.test.ts`)

### Testing Guidelines

For comprehensive patterns and best practices—including mocking fetch, Freighter wallet API, fake timers, and React Testing Library queries—refer to **[TESTING_GUIDE.md](./docs/TESTING_GUIDE.md)**.

Key points:
- Use accessibility-first queries (`getByRole`, `getByLabelText`)
- Mock external dependencies (fetch, wallet API, services)
- Maintain 95% coverage on covered files
- Write tests from the user's perspective, not implementation details
- Linting: Run `pnpm lint` before committing to ensure code quality.

## 🔄 Contribution Workflow

1.  **Fork & Clone**: Fork the repository and clone it locally.
2.  **Branch**: Create a feature branch (`git checkout -b feature/my-feature`).
3.  **Develop**: Write code following the standards above.
4.  **Lint**: Run `pnpm lint` to check for errors.
5.  **Commit**: Use descriptive commit messages.
    -   `feat: Add wallet connection`
    -   `fix: Resolve layout issue on mobile`
    -   `docs: Update README`
6.  **Push**: Push to your fork and submit a Pull Request.

## 📦 Dependency Management

-   We use `pnpm` for fast and efficient package management.
-   To add a dependency: `pnpm add <package-name>`
-   To add a dev dependency: `pnpm add -D <package-name>`

## 🔗 External Integrations

### Soroban Smart Contracts

Interaction with smart contracts is handled in `src/utils/soroban.ts`.
-   **Contract Addresses**: Managed via environment variables.
-   **ABIs**: Types should be generated from the contract XDR/WASM (future task).

### Wallets

-   We use `@stellar/freighter-api` to communicate with the user's wallet.
-   Ensure you handle cases where the wallet is not installed or the user rejects a transaction.

## 🔒 Strict TypeScript Flags

`tsconfig.json` enables several flags beyond `strict: true`. Here is the rationale for each:

### `noUncheckedIndexedAccess`
Array and object index access (e.g. `arr[0]`, `obj[key]`) returns `T | undefined` instead of `T`. This catches a real class of runtime errors in a data-heavy app that indexes arrays of commitments, attestations, and chart payloads.

**Required pattern:** guard or destructure before use.
```ts
// ❌ fails — value may be undefined at runtime
const tier = protocol.penalties[0];

// ✅ guard first
const defaultTier = protocol.penalties[0];
if (!defaultTier) throw new Error("Missing penalty config");

// ✅ or destructure a known-length tuple
const [min, max] = filters.priceRange;
```

### `exactOptionalPropertyTypes`
An optional property `foo?: string` means the key may be **absent** — it does not mean it may be set to `undefined`. This prevents accidentally widening an object's type and keeps serialisation (e.g. JSON.stringify) predictable.

**Required pattern:** omit the key rather than setting it to `undefined`.
```ts
// ❌ fails
const payload = { penaltyAmount: undefined, exitedBy: addr };

// ✅ omit the key
const payload = { exitedBy: addr };
```

### `noImplicitOverride`
Derived class methods that override a base class method must use the `override` keyword. Prevents silent method shadowing when a base class signature changes.

### `noFallthroughCasesInSwitch`
Every non-empty `switch` case must end with `break`, `return`, or `throw`. Prevents accidental fallthrough bugs.

### Keeping the build clean
Run `tsc --noEmit` before submitting a PR. No `as any` escape hatches — use proper narrowing, type guards, or `satisfies`.
