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
