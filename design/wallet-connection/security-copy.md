# Wallet Connection — Security Copy & Microcopy

This document is the **copy bank** for everything in the wallet connection and signing flow.
It exists because security copy is the single most-violated part of crypto UX — most apps
either say nothing ("Sign to continue") or say too much ("By signing, you authorize…
[400-word ToS]"). Both fail the user.

The rules below apply to every string in [`states.md`](./states.md) and any future copy in
this surface.

---

## Core Principles

1. **Name the thing.** "This signature proves you own this wallet" is better than
   "Authentication." Always say what the signature **does**.
2. **Name what it cannot do.** Users overestimate signing risk because most apps mix login
   signatures with transaction signatures. Tell them, in the same modal, that this signature
   **cannot move funds**.
3. **No reassurance theater.** Words like "safe", "secure", "trusted" without specifics are
   noise. Replace `This is safe` with the concrete reason it's safe.
4. **Plain English over crypto jargon.** "Random one-time number" beats "nonce". Use the
   jargon term only when it appears in the literal message the user signs.
5. **Imperative for actions, declarative for status.** Buttons say
   `Connect Freighter`; status lines say `We're waiting for you to approve…`. Mixing voices
   makes the modal feel inconsistent.
6. **One sentence at a time.** Body copy is at most two sentences. If a state needs more,
   it needs a numbered list.
7. **No exclamation marks. No emoji.** The flow is about money. Exclamation marks read as
   marketing; emoji read as casual.

---

## The Three Signatures Explained

The flow has exactly three security copy lines that explain what is happening at each
decision point. They are stable strings; do not paraphrase them per state.

### 1. The connect line

> Connecting only shares your public address. It does not move funds.

**Where it appears:** `S4`, `S5`, `E1`.
**What it tells the user:** sharing an address is read-only.
**Why this exact wording:** "shares your public address" is the literal effect of
`getAddress()` in the Freighter API; "does not move funds" is the user's actual concern.

### 2. The sign-in line

> This signature only proves you own this wallet. It cannot send funds, approve transfers,
> or change anything on-chain.

**Where it appears:** `S7`, `S8`, `E2`.
**What it tells the user:** this is a login signature, not a transaction signature.
**Why this exact wording:** the three forbidden actions ("send funds", "approve transfers",
"change anything on-chain") cover the three ways a malicious signature can hurt a user.
Stating all three closes the loop.

### 3. The network line

> Signing on the wrong network does not move funds, but it can mix testnet and mainnet
> identities. We block this on purpose.

**Where it appears:** `S6`.
**What it tells the user:** the block is intentional, not a bug.
**Why this exact wording:** "we block this on purpose" pre-empts the "let me continue
anyway" reflex without lecturing.

---

## The Message Preview (S7)

The most-scrutinized text in the entire flow is the message preview in `S7`. It must be a
**verbatim** reproduction of the string the wallet will display, rendered in monospaced
type so the user can letter-by-letter compare with the Freighter popup.

### Layout

```
┌────────────────────────────────────────────────────┐
│  Message you'll sign                               │
├────────────────────────────────────────────────────┤
│   Sign in to CommitLabs: a1b2c3d4-…-9z             │
│   ── prefix ────────────  ── nonce ───             │
└────────────────────────────────────────────────────┘
Below preview:
   • prefix: "Sign in to CommitLabs:" — Identifies CommitLabs as the requester.
   • nonce: random one-time number that prevents replay.
Connected as: G…X4Y5
```

### Rules

* **Verbatim.** The preview text equals the bytes that will be passed to
  `signTransaction()` — no cleanup, no truncation. If the message has a `\n`, render the
  `\n` literally.
* **Monospace.** A monospace font is the only safe way to invite letter-level comparison.
* **Labels below, not inline.** Inline annotations destroy the verbatim property.
* **No copy/paste of the nonce.** The nonce is rotated per challenge; copying it has no use
  and invites suspicion ("why is this app letting me copy a security token?").

---

## Truncation

Stellar addresses are 56 characters and unreadable. We truncate everywhere except the
sign-message preview.

| Where | Format | Example |
| :---- | :----- | :------ |
| Modal subhead, success toasts | `G…X4Y5` (1 leading + ellipsis + 4 trailing) | `G…X4Y5` |
| Modal body ("Connected as") | `G…AB12X4Y5` (1 + 8 trailing) | `G…AB12X4Y5` |
| Account picker in profile | full 56 chars, `aria-label` says "Stellar account address" | n/a |
| The signed message itself | **never truncated** — it's a literal string |

Every truncated address has a `Copy` icon button next to it. Successful copy fires a
non-intrusive toast: `Copied`.

---

## Copy Bank by State

Lifted from [`states.md`](./states.md) for fast reviewer cross-checking. Keep these in sync.

| State | Header | Subhead | Body lead |
| :---- | :----- | :------ | :-------- |
| `S1` | `Connecting to Freighter` | `Checking for your Freighter extension…` | (visual only) |
| `S2` | `Freighter wallet not found` | `CommitLabs uses Freighter to connect your Stellar account.` | `1. Install Freighter from the official site. 2. Refresh this page. We'll detect it automatically.` |
| `S3` | `Your Freighter wallet is locked` | `Unlock Freighter to continue.` | `Open your Freighter extension and enter your password. We'll continue automatically once it's unlocked.` |
| `S4` | `Connect Freighter` | `Sign in to CommitLabs with your Stellar account.` | (two-column "we will / we won't") |
| `S5` | `Approve in your Freighter extension` | `We're waiting for you to approve the connection.` | `If you don't see the popup, click the Freighter icon in your browser toolbar.` |
| `S6` | `Wrong network selected` | `CommitLabs is running on <app-network>. Your Freighter wallet is set to <wallet-network>.` | `1. Open your Freighter extension. 2. Switch the network to <app-network>. 3. We'll continue automatically.` |
| `S7` | `Sign in to CommitLabs` | `One short signature to confirm your wallet, then you're in.` | (message preview + labeled list) |
| `S8` | `Approve the signature in Freighter` | `We're waiting for you to sign the message.` | `Check the message in Freighter matches the one shown above.` |
| `S9` | `Verifying signature…` | `Almost there.` | `Confirming with CommitLabs…` |
| `S10` | `Connected` | `You're signed in as <truncated-address>.` | (visual only) |
| `E1` | `Connection canceled` | `You declined the connection in Freighter.` | `No data was shared with CommitLabs. You can try again whenever you're ready.` |
| `E2` | `Sign-in canceled` | `You declined the signature in Freighter.` | `No signature was sent. Your wallet is connected but you're not signed in yet.` |
| `E3` | `Still waiting on Freighter` | `We didn't hear back from your wallet.` | `Make sure the Freighter popup is open. If it's not, click the Freighter icon in your browser toolbar to bring it forward.` |
| `E4` | `Couldn't reach Freighter` | `Your Freighter extension returned an error.` | `Try reloading Freighter, then come back to this page. If the problem continues, update Freighter to the latest version.` |
| `E5` | `Couldn't sign you in` | `Your signature was created but we couldn't verify it.` | (cause-specific — see [`states.md` § E5](./states.md#e5--server-error-verify)) |

---

## Buttons & Toasts

### Primary actions

| State | Label | Notes |
| :---- | :---- | :---- |
| `S2` | `Install Freighter →` | Right-arrow signals external link |
| `S3`, `S6` | `Open Freighter` | Same wording across states |
| `S4` | `Connect Freighter` | Verb-first, names the wallet |
| `S7` | `Sign in` | Not "Sign message" — the user is signing **in**, not signing a transaction |
| `E1`, `E2`, `E3`, `E5` | `Try again` | Single phrase, never "Retry" / "Try Again" |
| `E4` | `Reload page` | Names the action; `Reload Freighter` would falsely imply our app can do that |

### Secondary actions

| Context | Label |
| :------ | :---- |
| Always available unless noted | `Cancel` |
| `E2` only | `Disconnect wallet` |

### Toasts

| Trigger | Toast text |
| :------ | :--------- |
| Success → entry point | `Connected as G…X4Y5  ·  Disconnect` |
| Cancel from any state | `Wallet not connected. You can reconnect anytime from the top right.` |
| Successful copy of address | `Copied` |
| Disconnect from session | `Wallet disconnected.` |

---

## Forbidden Phrases

These phrases must not appear in this surface. They have specific failure modes.

| Phrase | Why it's banned |
| :----- | :-------------- |
| `Sign to continue` | Says nothing about what the signature does. |
| `Authorize CommitLabs to access your wallet` | "Authorize" implies write access; we have none. |
| `Connect your wallet to get started` | Marketing tone; the user is mid-flow, not on a landing page. |
| `Don't worry, this is safe.` | Reassurance theater. Replace with the concrete reason. |
| `Something went wrong.` (alone) | Always pair with a cause clause. |
| `Error: …` (raw) | Stack traces never go above the fold; use the recognized cause clauses. |
| `🦄 / 🚀 / 🎉` (any emoji) | Wrong tone for a money flow. |
| `your wallet` (when the brand is known) | Use `your Freighter wallet` or `Freighter`. |

---

## Variables & Interpolation

Strings that include variables use `<variable>` braces. The data layer must populate these
exactly; do not localize the placeholder name.

| Variable | Source | Example |
| :------- | :----- | :------ |
| `<app-network>` | `process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE` mapped to `Testnet` / `Mainnet` | `Testnet` |
| `<wallet-network>` | Freighter `getNetwork()` mapped to `Testnet` / `Mainnet` | `Mainnet` |
| `<truncated-address>` | `formatAddress(address, 1, 4)` (or 1, 8 in body contexts) | `G…X4Y5` |
| `<nonce>` | Server response from `/api/auth/challenge` | `a1b2c3d4-…-9z` |

If the data layer cannot resolve `<app-network>` or `<wallet-network>`, fall back to the
literal `Stellar network` and the modal degrades to a generic mismatch message — but this
fallback should be considered a bug, not a feature.

---

## Localization Notes (forward-looking)

CommitLabs is single-locale today (en-US). When localization is added:

* The three security copy lines are highest-priority strings; they must be reviewed by a
  native speaker, not auto-translated.
* The message preview in `S7` is **never localized** — the user signs the literal English
  string emitted by the server. The labels below the preview *are* localized.
* Address truncation rules (`G…X4Y5`) are language-agnostic and remain unchanged.

---

## QA Checklist for Copy

- [ ] Every string in [`states.md`](./states.md) matches the table above.
- [ ] The message preview in `S7` is monospaced and verbatim.
- [ ] No forbidden phrase appears anywhere in the flow.
- [ ] Every variable in copy resolves to a real value before the modal renders.
- [ ] Truncated addresses always have a copy button.
- [ ] No string ends with an exclamation mark.
- [ ] No emoji anywhere in this surface.
- [ ] Cause clauses (`Network`, `Server`, `Expired nonce`, …) are wired to error reasons,
      not hard-coded.
