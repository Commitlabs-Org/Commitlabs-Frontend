# Architecture

CommitLabs is a Next.js 14 App Router application with browser-side demo state and direct
Stellar Soroban RPC integration. There is no application API layer between the browser and
Horizon or Soroban RPC.

```text
Browser
  └─ Next.js App Router (src/app)
       ├─ /, /create, /dashboard, /docs
       ├─ /activity ─────────────── Soroban contract events
       └─ /commitments/[id] ─────── Soroban commitment / attestation / dispute reads
            ├─ Demo state: src/lib/commitments.ts → localStorage (memory fallback)
            ├─ Wallet: Freighter; XLM balance via Horizon
            └─ Soroban clients: src/lib/soroban/*
                 ├─ reads, events, protocol status and error mapping
                 ├─ tx simulation → Freighter signature → RPC submit / poll
                 └─ generated Client: packages/escrow-client
                      └─ contracts/escrow on Stellar
```

## Routes

- `/` — landing page (`src/app/page.tsx`).
- `/create` — configure and review a commitment (`src/app/create/page.tsx`).
- `/dashboard` — browser-stored commitments, wallet balance, recent chain events, and dispute details
  (`src/app/dashboard/page.tsx`).
- `/docs` — in-app protocol explanation (`src/app/docs/page.tsx`).
- `/activity` — filtered Soroban contract event feed (`src/app/activity/page.tsx`).
- `/commitments/[id]` — validated on-chain commitment details, attestations, and dispute (`src/app/commitments/[id]/page.tsx`).

## Data flow: demo storage and chain

`src/lib/commitments.ts` validates and migrates commitment records in `localStorage`, with an
in-memory fallback when storage cannot be used. The create flow writes there; dashboard settle
and early-exit controls only change that local record. **Create, settle, and early exit are still
local-only demo actions: they do not create or settle an escrow commitment on-chain.**

On-chain reads are real Soroban RPC simulations: `src/lib/soroban/read.ts` loads commitment,
attestation, and dispute data; `src/lib/soroban/events.ts` reads contract events; and
`src/lib/soroban/protocol-status.ts` reads pause state and yield-pool balance. `src/lib/protocol.ts`
loads default penalty and grace-period parameters, caching successful results in memory and using
defined fallback values when unavailable. The dashboard can submit a dispute via
`src/lib/soroban/escrow.ts` for an on-chain commitment; this is a transaction, unlike its local
demo lifecycle controls.

## Wallet and transaction pipeline

`src/lib/soroban/tx.ts` checks that Freighter is connected and that its address matches the
requested source and signer. It builds the invocation, simulates it before requesting a wallet
signature, submits the signed transaction to Soroban RPC, then polls for completion and returns
the transaction hash or a typed error (`src/lib/soroban/errors.ts`). Read-only simulations do not
request a signature. `src/lib/soroban/escrow-client.ts` adapts configuration and Freighter signing
to the generated typed client in `packages/escrow-client`.

## Security headers and CSP

`src/middleware.ts` creates a cryptographic per-request nonce and applies the CSP as both response
and request headers; `src/app/layout.tsx` uses the nonce for rendered scripts. The policy in
`src/lib/security/csp.ts` restricts scripts to the nonce and `strict-dynamic`, and connections to
self plus configured Horizon and Soroban RPC origins. `unsafe-eval` is development-only;
`upgrade-insecure-requests` is production-only.

`next.config.js` adds `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Strict-Transport-Security`, `Permissions-Policy`, and `Cross-Origin-Opener-Policy`.

## Bindings drift check

`packages/escrow-client` contains generated TypeScript bindings. `.github/workflows/contracts.yml`
rebuilds the contract and regenerates bindings with `scripts/gen-escrow-bindings.sh`, then fails
when `git diff --exit-code packages/escrow-client` detects drift. The same workflow type-checks
the frontend.

## Performance budgets

`performance-budgets.json` sets gzip first-load JavaScript maxima of 105,867 bytes for `/`,
110,418 for `/create`, and 115,000 for `/dashboard`; `scripts/check-bundle-budget.mjs` enforces
them and checks that Freighter is absent from `/` first-load JavaScript. `.github/workflows/perf.yml`
runs these checks and Lighthouse CI. `lighthouserc.json` requires a mobile performance score of at
least 0.9, LCP at most 2,500 ms, CLS at most 0.1, and TBT at most 200 ms.
