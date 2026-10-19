# Architecture

```
Browser (Next.js 14 App Router)
 |- pages: / , /create , /dashboard , /docs
 |- lib/commitments.ts  domain model, type presets, localStorage persistence (demo mode)
 |- lib/wallet.ts       optional Freighter connection + Horizon balance lookup
 |- lib/config.ts       public env (network, RPC, contract IDs)
 `- Stellar testnet: Soroban escrow contract (contracts/escrow)
```

- The UI is a static Next.js app (no server code), deployed on Vercel.
- Commitments created in the UI are stored in browser local storage (demo mode).
- The escrow contract in `contracts/escrow` is deployed to Stellar testnet. Its ID is in
  `deployments/testnet.json` and `NEXT_PUBLIC_ESCROW_CONTRACT_ID`.
- Wallet connection is optional. Without Freighter the app shows a notice and keeps working.
