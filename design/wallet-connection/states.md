# Wallet Connection — Per-State Specs

This document defines the **visual and content spec** for every state in the wallet
connection flow. State IDs match [`flow-diagram.md`](./flow-diagram.md). Errors with
recovery actions are detailed further in [`errors-and-recovery.md`](./errors-and-recovery.md).

All states use the shared modal anatomy (header / subhead / body / security strip /
footer) defined in [`flow-diagram.md`](./flow-diagram.md).

---

## State Index

| ID | Name | Section |
| :- | :--- | :------ |
| `S1` | Detecting | [↓](#s1--detecting) |
| `S2` | Not installed | [↓](#s2--not-installed) |
| `S3` | Locked wallet | [↓](#s3--locked-wallet) |
| `S4` | Connect prompt | [↓](#s4--connect-prompt) |
| `S5` | Awaiting connect approval | [↓](#s5--awaiting-connect-approval) |
| `S6` | Network mismatch | [↓](#s6--network-mismatch) |
| `S7` | Sign challenge prompt | [↓](#s7--sign-challenge-prompt) |
| `S8` | Awaiting signature | [↓](#s8--awaiting-signature) |
| `S9` | Verifying signature | [↓](#s9--verifying-signature) |
| `S10` | Connected (success) | [↓](#s10--connected-success) |
| `E1` | Rejected — connect | [↓](#e1--rejected--connect) |
| `E2` | Rejected — signature | [↓](#e2--rejected--signature) |
| `E3` | Timeout | [↓](#e3--timeout) |
| `E4` | Extension error | [↓](#e4--extension-error) |
| `E5` | Server error (verify) | [↓](#e5--server-error-verify) |

---

## `S1` — Detecting

**Purpose:** Brief check that Freighter is installed and unlocked. Capped at 3 seconds.

| Region | Content |
| :----- | :------ |
| Header | `Connecting to Freighter` |
| Subhead | `Checking for your Freighter extension…` |
| Body | Centered Freighter logo + 3-dot pulsing indicator. No text below the indicator. |
| Security strip | Hidden |
| Primary action | Disabled `Connect` (label dim, spinner inside) |
| Secondary action | `Cancel` |

**A11y:** Body has `aria-busy="true"` and `aria-live="polite"` so the transition to a
real state is announced.

---

## `S2` — Not installed

**Purpose:** Freighter is not detected after the 3-second window. Help the user install it,
not lecture them.

| Region | Content |
| :----- | :------ |
| Header | `Freighter wallet not found` |
| Subhead | `CommitLabs uses Freighter to connect your Stellar account.` |
| Body | Illustration: muted Freighter logo with a small "missing" badge. Below: `1. Install Freighter from the official site. 2. Refresh this page. We'll detect it automatically.` |
| Security strip | `ⓘ Install only from freighter.app — never from a search ad or download mirror.` |
| Primary action | `Install Freighter →` (opens `https://www.freighter.app` in a new tab) |
| Secondary action | `Cancel` |
| Below body | Link: `Already installed? Refresh and we'll detect it.` (triggers re-detect immediately) |

**Polling:** While this state is visible, the modal re-detects every 1.5 s. If the user
installs Freighter and pins it, the modal advances automatically.

---

## `S3` — Locked wallet

**Purpose:** Freighter is installed but locked. Tell the user exactly what to do without
guessing what their PIN flow looks like.

| Region | Content |
| :----- | :------ |
| Header | `Your Freighter wallet is locked` |
| Subhead | `Unlock Freighter to continue.` |
| Body | Illustration: locked padlock icon (from iconography system) with the Freighter logo. Below: `Open your Freighter extension and enter your password. We'll continue automatically once it's unlocked.` |
| Security strip | Hidden — there is nothing to sign yet. |
| Primary action | `Open Freighter` — focuses the extension if the browser supports it; otherwise no-op with a tooltip "Click the Freighter icon in your browser toolbar." |
| Secondary action | `Cancel` |

**Polling:** Re-detects every 1.5 s. Auto-advances to `S1`/`S4` when the wallet is unlocked.

---

## `S4` — Connect prompt

**Purpose:** Wallet is detected and unlocked. The user has not yet approved sharing the
account with our app.

| Region | Content |
| :----- | :------ |
| Header | `Connect Freighter` |
| Subhead | `Sign in to CommitLabs with your Stellar account.` |
| Body | Two-column block: **Left** — what we'll do (`Read your public Stellar address`, `Ask you to sign one short message to prove ownership`). **Right** — what we will **never** do (`Move your funds`, `See your secret key`). |
| Security strip | `ⓘ Connecting only shares your public address. It does not move funds.` |
| Primary action | `Connect Freighter` |
| Secondary action | `Cancel` |

The "what we will never do" column is the most important part of this state. It is the
only place in the flow where we use a strikethrough/cross icon to hammer the point.

---

## `S5` — Awaiting connect approval

**Purpose:** We've called the Freighter API. Focus has moved to the extension. The modal
must explain that and not pretend to know what's happening.

| Region | Content |
| :----- | :------ |
| Header | `Approve in your Freighter extension` |
| Subhead | `We're waiting for you to approve the connection.` |
| Body | Illustration: Freighter logo with an animated "look up at the toolbar" arrow pointing to the top-right corner of the viewport. Below: `If you don't see the popup, click the Freighter icon in your browser toolbar.` |
| Security strip | `ⓘ Connecting only shares your public address. It does not move funds.` (same as `S4`) |
| Primary action | Hidden — the action is now in the extension. |
| Secondary action | `Cancel` |

**Timeout:** 60 s → `E3`.

---

## `S6` — Network mismatch

**Purpose:** Freighter is on a different Stellar network than the app. Hard stop.

| Region | Content |
| :----- | :------ |
| Header | `Wrong network selected` |
| Subhead | `CommitLabs is running on <app-network>. Your Freighter wallet is set to <wallet-network>.` |
| Body | Side-by-side network chips: app side fixed (`<app-network>`, semantic color from iconography system), wallet side current (`<wallet-network>`, warning color). Below: numbered steps — `1. Open your Freighter extension. 2. Switch the network to <app-network>. 3. We'll continue automatically.` |
| Security strip | `ⓘ Signing on the wrong network does not move funds, but it can mix testnet and mainnet identities. We block this on purpose.` |
| Primary action | `Open Freighter` (same behavior as `S3`) |
| Secondary action | `Cancel` |

**Why a hard stop:** auth tokens are scoped to a network. A user who signs with their
mainnet account against a testnet app produces a token that does not match their commitments.
We treat the mismatch as a security event, not a UX warning.

---

## `S7` — Sign challenge prompt

**Purpose:** Connection is approved. We now need a signature on the auth challenge to
prove the user controls the address. This is the *most important* security copy in the
entire flow — see [`security-copy.md`](./security-copy.md).

| Region | Content |
| :----- | :------ |
| Header | `Sign in to CommitLabs` |
| Subhead | `One short signature to confirm your wallet, then you're in.` |
| Body | A "message preview" card showing the **exact** message the user will sign — pulled from the server's challenge response. Below the preview, a labeled list explains every part: `Sign in to CommitLabs: <nonce>` → "Random one-time number that prevents replay." Below the list: `Connected as: <truncated-address>`. |
| Security strip | `ⓘ This signature only proves you own this wallet. It cannot send funds, approve transfers, or change anything on-chain.` |
| Primary action | `Sign in` |
| Secondary action | `Cancel` |

The message preview is **not** a stylized graphic — it is a monospaced reproduction of the
message string the wallet will display. Users who cross-check the preview against the
extension popup must see identical text.

---

## `S8` — Awaiting signature

**Purpose:** Same shape as `S5`, but for signing. Focus has moved to the extension.

| Region | Content |
| :----- | :------ |
| Header | `Approve the signature in Freighter` |
| Subhead | `We're waiting for you to sign the message.` |
| Body | Same arrow illustration as `S5`. Below: `Check the message in Freighter matches the one shown above.` |
| Security strip | Same as `S7`. |
| Primary action | Hidden. |
| Secondary action | `Cancel` |

**Timeout:** 60 s → `E3`.

---

## `S9` — Verifying signature

**Purpose:** Signature is back; we're posting it to `/api/auth/verify` (see
[`docs/session-implementation.md`](../../docs/session-implementation.md)).

| Region | Content |
| :----- | :------ |
| Header | `Verifying signature…` |
| Subhead | `Almost there.` |
| Body | Centered spinner + `Confirming with CommitLabs…`. No animation beyond the spinner; this state should be ≤ 1 s typical. |
| Security strip | Hidden — the user is no longer in a decision step. |
| Primary action | Disabled `Sign in` (spinner inside). |
| Secondary action | Hidden — cancelling here does nothing useful, the request is in flight. |

**Timeout:** 15 s → `E5`.

---

## `S10` — Connected (success)

**Purpose:** Done. Auto-closes after 1.5 s.

| Region | Content |
| :----- | :------ |
| Header | `Connected` |
| Subhead | `You're signed in as <truncated-address>.` |
| Body | Centered green check icon (from iconography system). No text below. |
| Security strip | Hidden. |
| Primary action | Hidden. |
| Secondary action | Hidden. |

After auto-close, a 4-second toast appears at the bottom of the page:

> Connected as G…X4Y5 · [Disconnect]

---

## `E1` — Rejected — connect

**Purpose:** User pressed Reject in the Freighter popup during `S5`. We do not blame them.

| Region | Content |
| :----- | :------ |
| Header | `Connection canceled` |
| Subhead | `You declined the connection in Freighter.` |
| Body | Neutral icon (info-circle from iconography). Below: `No data was shared with CommitLabs. You can try again whenever you're ready.` |
| Security strip | `ⓘ Connecting only shares your public address. It does not move funds.` |
| Primary action | `Try again` → returns to `S5` (re-fires the connect call). |
| Secondary action | `Cancel` |

---

## `E2` — Rejected — signature

**Purpose:** User pressed Reject during `S8`. The wallet is connected but unauthenticated.

| Region | Content |
| :----- | :------ |
| Header | `Sign-in canceled` |
| Subhead | `You declined the signature in Freighter.` |
| Body | Same neutral icon. Below: `No signature was sent. Your wallet is connected but you're not signed in yet.` |
| Security strip | `ⓘ This signature only proves you own this wallet. It cannot send funds.` |
| Primary action | `Try again` → returns to `S8` (re-prompts the signature). |
| Secondary action | `Disconnect wallet` (closes the modal, releases the connection state). |

The presence of `Disconnect wallet` here is a deliberate choice: a user who refused to sign
should be able to fully back out, not just close the modal and leave a half-connection
behind.

---

## `E3` — Timeout

**Purpose:** No response from the extension within 60 s in `S5` or `S8`. The popup may have
been buried, dismissed, or never opened.

| Region | Content |
| :----- | :------ |
| Header | `Still waiting on Freighter` |
| Subhead | `We didn't hear back from your wallet.` |
| Body | Warning icon. Below: `Make sure the Freighter popup is open. If it's not, click the Freighter icon in your browser toolbar to bring it forward.` |
| Security strip | Whichever was active when the timeout fired (`S5` or `S8` copy). |
| Primary action | `Retry` → returns to whichever state timed out. |
| Secondary action | `Cancel` |

---

## `E4` — Extension error

**Purpose:** Freighter API threw an unrecognized error (extension crashed, version
incompatibility, browser context invalidated).

| Region | Content |
| :----- | :------ |
| Header | `Couldn't reach Freighter` |
| Subhead | `Your Freighter extension returned an error.` |
| Body | Error icon. Below: `Try reloading Freighter, then come back to this page. If the problem continues, update Freighter to the latest version.` Optional collapsible details: `Error: <message>` (developer-only, hidden behind `Show details`). |
| Security strip | Hidden. |
| Primary action | `Reload page` — full page reload is the safest recovery for a crashed extension context. |
| Secondary action | `Cancel` |
| Below body | Link to help / status page. |

---

## `E5` — Server error (verify)

**Purpose:** Signature is valid locally but `/api/auth/verify` failed (network down, server
500, nonce expired).

| Region | Content |
| :----- | :------ |
| Header | `Couldn't sign you in` |
| Subhead | `Your signature was created but we couldn't verify it.` |
| Body | Error icon. Cause clause inserted dynamically: `Network` / `Server` / `Expired nonce`. Body for each cause: |
| | `Network` — `Check your internet connection and try again.` |
| | `Server` — `Something went wrong on our side. Try again in a moment.` |
| | `Expired nonce` — `The login window expired. We'll generate a new one and try again.` |
| Security strip | `ⓘ Your signature was not stored. Retrying creates a new one.` |
| Primary action | `Try again` → for "Expired nonce", restarts at `S7` with a fresh challenge. For other causes, retries `S9`. |
| Secondary action | `Cancel` |

---

## Cross-State Visual Tokens

| Token | Value |
| :---- | :---- |
| Modal width | `min(480px, calc(100vw - 32px))` |
| Modal radius | 16 px |
| Modal background | `#0a0a0a` |
| Modal border | `1px solid rgba(255, 255, 255, 0.1)` |
| Header type | 1.25 rem / 600 |
| Subhead type | 0.875 rem / 400 / muted |
| Security strip type | 0.75 rem / 500 / muted, with `ⓘ` icon left |
| Primary button | filled, accent `#0ff0fc` |
| Secondary button | ghost, border `rgba(255, 255, 255, 0.15)` |
| Status icon | 48 px in body, 16 px in inline contexts |

---

## QA Checklist (per state)

- [ ] Header, subhead, body, security strip, footer all match the spec.
- [ ] Single modal frame is reused — no second modal opens between states.
- [ ] Security strip is **hidden** in `S1`, `S3`, `S9`, `S10`, `E4`.
- [ ] Cancel and `×` are reachable in every state where they are listed.
- [ ] No state shows raw error messages or stack traces above the fold.
- [ ] Address values are truncated as `G….X4Y5` (4 + 4 chars) and have a copy button.
- [ ] Polling stops as soon as the state transitions away from `S2` / `S3`.
- [ ] All copy passes the [`security-copy.md`](./security-copy.md) tone rules.
