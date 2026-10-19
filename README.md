# CommitLabs

[![Live demo](https://img.shields.io/badge/live-demo-5eead4)](https://commitlabs-frontend-pi.vercel.app)
![Stellar testnet](https://img.shields.io/badge/network-stellar%20testnet-818cf8)
![Next.js 14](https://img.shields.io/badge/Next.js-14-black)

**Liquidity as a commitment.** CommitLabs turns passive liquidity into enforceable, attestable on-chain
commitments on Stellar Soroban. Pick a risk profile, set amount, lock duration, loss tolerance and early-exit
penalty, and track the commitment from creation to settlement.

**Live demo: https://commitlabs-frontend-pi.vercel.app**

## Features

- Landing page explaining the protocol and the three risk profiles (Safe, Balanced, Aggressive)
- Four-step **Create commitment** wizard with validation, projected yield and review
- **Dashboard** with totals, progress bars, settle and early-exit actions
- Built-in **Docs** page (`/docs`)
- Optional Freighter wallet connect with graceful fallback and testnet XLM balance
- Soroban escrow contract in `contracts/`, deployed on testnet

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). In short: a static Next.js 14 app, browser-stored demo state,
optional Freighter wallet, and a Soroban escrow contract on Stellar testnet.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
npm run circular   # madge circular dependency check
```

## Environment variables

| Name | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | Network label |
| `NEXT_PUBLIC_HORIZON_URL` | `https://horizon-testnet.stellar.org` | Balance lookups |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` | Soroban RPC |
| `NEXT_PUBLIC_ESCROW_CONTRACT_ID` | see below | Deployed escrow contract |

## Deployed contracts (Stellar testnet)

| Contract | ID |
| --- | --- |
| commitlabs-escrow | [`CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4`](https://stellar.expert/explorer/testnet/contract/CBPNVNWDFZOUNB6REHBPGU2DRP4AJSVS7QJ3SEOUIDBTW6DZEHQKJ5E4) |

Full details in [deployments/testnet.json](deployments/testnet.json). Contract source and tests: [contracts/](contracts/).

## Deploy

Deployed on Vercel (framework preset: Next.js). Set the variables above in the Vercel project settings.

## Scope note

Commitment creation in the web app is currently a demo recorded in browser storage; on-chain invocation of the
escrow contract from the UI is not wired yet.

## License and contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
