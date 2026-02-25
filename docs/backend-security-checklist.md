# Backend Security Review Checklist
**Project:** Commitlabs-Frontend  
**Reference:** [#141 - Create a security review checklist for backend PRs](https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues/141)  
**Applies To:** All PRs touching `src/utils/`, `src/app/api/`, contract interaction logic, wallet handling, and environment configuration.

> **How to use this checklist:** When reviewing a backend PR, copy this checklist into your PR review comment or use it as a personal review guide. Every item marked ❌ must be resolved before the PR is approved and merged.

---

## 1. Authentication & Wallet Security

- [ ] Wallet connection is never auto-triggered without explicit user action
- [ ] No private keys, seed phrases, or mnemonics are ever logged, stored, or transmitted
- [ ] Wallet address is validated before being used in any contract call or query
- [ ] Session state is cleared properly on wallet disconnect
- [ ] No wallet credentials are ever written to `localStorage` in plaintext
- [ ] The PR does not expose or log the connected wallet's full address unnecessarily in UI or console

---

## 2. Input Validation

- [ ] All user inputs are validated on the client before being passed to contract calls
- [ ] Numeric fields (amounts, token values) are validated for type, range, and precision
- [ ] String inputs are sanitized — no raw user input is passed directly into contract function arguments
- [ ] Empty, null, and undefined inputs are handled explicitly and do not cause silent failures
- [ ] Address inputs are validated against Stellar/Soroban address format before use
- [ ] Form fields have both client-side and logical validation — not just UI-level checks

---

## 3. Environment Variables & Configuration

- [ ] No secrets, API keys, or private keys are hardcoded anywhere in the codebase
- [ ] All sensitive config values use `NEXT_PUBLIC_` prefix only for values safe to expose to the browser
- [ ] Server-only secrets do NOT use the `NEXT_PUBLIC_` prefix
- [ ] `.env` and `.env.local` files are listed in `.gitignore` and are not committed to the repository
- [ ] `.env.example` contains only placeholder values — no real keys or credentials
- [ ] RPC URL and network passphrase are sourced from environment variables, not hardcoded (see `src/utils/soroban.ts`)
- [ ] Contract addresses are sourced from environment variables and not hardcoded in source files

---

## 4. Contract Interaction Safety

- [ ] All Soroban contract calls are wrapped in `try/catch` — no unhandled promise rejections
- [ ] Contract call responses are validated before being used — never blindly trusted
- [ ] Transaction simulation is run before submission where applicable to catch errors early
- [ ] No contract call is made without first confirming the user is connected and authenticated
- [ ] Contract addresses are checked for existence/validity before any interaction
- [ ] Read calls and write calls are clearly separated and labeled in code
- [ ] Gas/fee estimation is handled gracefully — users are informed before signing

---

## 5. Error Handling

- [ ] All `async` functions have proper `try/catch` blocks
- [ ] Errors are never silently swallowed — all catch blocks either re-throw, log, or surface to the user
- [ ] Error messages shown to users do not expose internal stack traces, contract details, or system paths
- [ ] Failed transactions surface a clear, human-readable error to the UI
- [ ] Network errors (RPC timeouts, failed fetches) are handled and do not crash the app
- [ ] All error states have a recovery path — users are never left in a broken UI state

---

## 6. Logging

- [ ] No `console.log` statements remain in production-bound code that expose wallet addresses, private data, or contract state
- [ ] Debug logs are either removed or gated behind a `NODE_ENV === 'development'` check
- [ ] No sensitive transaction data is logged to the browser console in production
- [ ] Logging does not expose user-identifiable information (wallet address, commitment amounts) without consent

---

## 7. Dependency Security

- [ ] No new `npm` packages were added without a clear justification in the PR description
- [ ] Any newly added package has been checked on [npmjs.com](https://www.npmjs.com) for recent activity and known vulnerabilities
- [ ] `npm audit` has been run and any high/critical vulnerabilities are addressed
- [ ] No package versions are pinned to an insecure or deprecated version

```bash
# Run this before approving any PR that adds or changes dependencies
npm audit
```

---

## 8. Data Exposure

- [ ] No commitment data, user balances, or contract state is exposed in URLs or query parameters
- [ ] API routes (if any under `src/app/api/`) do not return more data than the client needs
- [ ] Mock data used in development is not accidentally shipped to production
- [ ] No test accounts, test keys, or test contract addresses are hardcoded in production code paths

---

## 9. Code Quality & Safety Patterns

- [ ] No use of `eval()`, `Function()`, or `dangerouslySetInnerHTML` without strict justification
- [ ] No `any` TypeScript types are introduced without a comment explaining why
- [ ] All new utility functions in `src/utils/` are pure where possible and do not produce side effects unexpectedly
- [ ] Async race conditions are handled — no component updates state after unmount
- [ ] No infinite loops or unguarded recursion in contract polling or data fetching logic

---

## 10. Stellar / Soroban Specific

- [ ] The correct network passphrase is used — testnet and mainnet passphrases must never be mixed
- [ ] Transactions are built with the correct sequence number handling
- [ ] XDR encoding/decoding is handled via the official Stellar SDK — no custom implementations
- [ ] The PR does not interact with mainnet contracts from a testnet configuration or vice versa
- [ ] Freighter (or other wallet) API calls are guarded — the app does not assume the extension is installed

---

## 11. PR Hygiene

- [ ] The PR description clearly states what backend/utility code was changed and why
- [ ] No unrelated changes are bundled into this PR
- [ ] All new functions and exports are documented with a brief inline comment
- [ ] The PR does not introduce new TODOs without a corresponding GitHub issue
- [ ] The PR has been self-reviewed by the author before requesting review

---

## Quick Reference — Commands to Run Before Approving

```bash
# Check for secrets accidentally committed
grep -rn "SECRET\|PRIVATE_KEY\|MNEMONIC\|SEED" src/ --include="*.ts" --include="*.tsx"

# Check for console.logs left in production code
grep -rn "console.log" src/ --include="*.ts" --include="*.tsx"

# Check for hardcoded URLs or contract addresses
grep -rn "soroban-testnet\|stellar.org\|GABC\|CABC" src/ --include="*.ts" --include="*.tsx"

# Check for any type usage
grep -rn ": any" src/ --include="*.ts" --include="*.tsx"

# Run dependency audit
npm audit
```

---

## Severity Guide

Use this when flagging issues during review:

| Severity | Description | Example |
|----------|-------------|---------|
| 🔴 **Critical** | Must be fixed before merge — security risk | Private key in source code |
| 🟠 **High** | Must be fixed before merge — data or user risk | Unhandled contract error crashes app |
| 🟡 **Medium** | Should be fixed or tracked as an issue | `console.log` leaking wallet address |
| 🔵 **Low** | Nice to fix — code quality concern | TypeScript `any` type without comment |
| ⚪ **Info** | Observation only — no action required | Minor naming inconsistency |

---
