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

## 🧪 Testing Procedures

*(Note: Testing framework setup is currently in progress)*

-   **Unit Tests**: We plan to use Vitest + React Testing Library.
-   **Integration Tests**: Test user flows (e.g., creating a commitment) end-to-end.
-   **Linting**: Run `pnpm lint` before committing to ensure code quality.

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
