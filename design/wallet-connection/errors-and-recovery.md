# Wallet Connection — Errors & Recovery

> **Status: Aspirational / Not yet implemented.**
> The flow described in this document has not been built. The current implementation
> (`src/components/WalletConnectButton.tsx`) is a single button with a three-bucket
> keyword-match error helper (`walletErrorMessage`). None of the states (S1–S10),
> error categories (E1–E5), re-detect polling, timeouts, hard network-mismatch stop,
> "Install Freighter →" action, or telemetry events described below exist in production.
> Do not assume this flow is live. This document describes the intended design for a
> future implementation.

---

This document maps every failure mode in the wallet connection flow to a recovery action.
Per-state visual specs are in [`states.md`](./states.md); this file focuses on **what
happens after the failure**.

A working flow does not have fewer failures than a broken one — it has the same failures
with shorter recovery paths.

---

## Error Taxonomy

Every failure resolves to one of these five categories. The state ID is the modal state the
user lands in; the cause is the underlying reason.

| Cause | State | Source | Recovery primary action |
| :---- | :---- | :----- | :---------------------- |
| Wallet not detected | `S2` | Browser API returned no extension after 3 s | `Install Freighter →` |
| Wallet locked | `S3` | Freighter API replied with locked status | `Open Freighter` |
| Network mismatch | `S6` | Active network ≠ app network | `Open Freighter` (then switch) |
| User rejected (connect) | `E1` | Freighter API rejected on connect | `Try again` |
| User rejected (sign) | `E2` | Freighter API rejected on sign | `Try again` |
| Timeout | `E3` | No response in 60 s | `Retry` |
| Extension error | `E4` | Freighter API threw / context invalidated | `Reload page` |
| Server error (verify) | `E5` | `/api/auth/verify` returned non-2xx | `Try again` (with cause-specific copy) |

---

## Recovery Primitives

The flow uses these recovery patterns. Every error state composes one or more.

### 1. Re-detect

Used by: `S2`, `S3`, `S6` (after network switch).

* The modal polls Freighter every **1.5 s**.
* When the underlying condition clears, the modal advances automatically.
* No "Refresh" button is required; the polling is invisible.
* After **30 s** of polling with no change, a `Need help?` link surfaces below the body
  copy.

### 2. Manual retry

Used by: `E1`, `E2`, `E3`, `E5`.

* The user clicks `Try again` or `Retry` (label per state, see
  [`security-copy.md`](./security-copy.md)).
* Returns to the in-flight state that failed (`S5` for connect retries; `S8` for sign
  retries; `S9` for verify retries).
* No silent / automatic retries — see *Hard rules* below.

### 3. Hard reset

Used by: `E4`.

* Full page reload. The Freighter extension context can become invalidated when the
  extension auto-updates mid-session; only a page reload reliably recovers from that.
* The reload preserves the entry point via `?next=` so the user resumes where they were.

### 4. Disconnect

Used by: `E2`.

* User opted out of signing. We release the connection state on our side so they're not
  stuck in a half-connected state.
* This is **not** a generic recovery action — it appears only in `E2` because that's the
  only state where the user has approved connect but explicitly refused to authenticate.

### 5. Cause-specific retry

Used by: `E5`.

* The server-error state inspects the failure cause and adjusts:
  * `Network` → `Try again` repeats the verify call.
  * `Server` → same, with a "Try again in a moment" hint.
  * `Expired nonce` → restart at `S7` with a fresh challenge from the server.

---

## Hard Rules

These rules govern every recovery in the flow. They exist to prevent specific footguns
that have hurt users elsewhere.

1. **No invisible auto-retries.** A reject (`E1`/`E2`) does not silently re-fire the
   request. Users should not be trained to dismiss popups they didn't expect.
2. **No "skip" button on errors.** Every error state has at most two actions: a recovery
   primary and a cancel/disconnect secondary. Adding a `Skip` muddles the security model.
3. **Never advance past a network mismatch.** No "continue with caution", no "I understand,
   proceed". The block is the security feature.
4. **Server errors never expose stack traces.** `E5` shows a cause clause (`Network`,
   `Server`, `Expired nonce`) and a human sentence. Raw error bodies are logged server-side,
   not surfaced.
5. **Three retries, then escalate.** `E5` (verify) caps at 3 retries. After the third, the
   primary action becomes `Contact support` linking to the help surface.
6. **Cancel is always destructive-safe.** Cancelling never sends data; users can cancel any
   in-flight state without consequence beyond returning to the entry point.

---

## Error → State Mapping (Detailed)

### Wallet not detected (`S2`)

| Field | Value |
| :---- | :---- |
| Trigger | Detection (`S1`) timed out after 3 s OR `isConnected()` returned `false` |
| Recovery primary | `Install Freighter →` opens `https://www.freighter.app` in a new tab |
| Below-body fallback | `Already installed? Refresh and we'll detect it.` (re-runs detection now) |
| Auto-advance | Yes — re-detect every 1.5 s |
| Help surface | After 30 s, `Need help?` link → "Trouble detecting Freighter?" article |

### Wallet locked (`S3`)

| Field | Value |
| :---- | :---- |
| Trigger | Freighter `isAllowed()` returned `false` OR `getAddress()` rejected with `LOCKED` |
| Recovery primary | `Open Freighter` (focus extension if browser allows; otherwise hint copy) |
| Auto-advance | Yes — re-detect every 1.5 s |
| Help surface | After 30 s, `Need help?` link → "Freighter says locked but I unlocked it" article |

### Network mismatch (`S6`)

| Field | Value |
| :---- | :---- |
| Trigger | Freighter `getNetwork()` ≠ `process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE` |
| Recovery primary | `Open Freighter`, with copy guiding the network switch |
| Auto-advance | Yes — Freighter network-change event triggers re-detect |
| Hard stop | Yes — no "continue anyway" affordance |

### Reject — connect (`E1`)

| Field | Value |
| :---- | :---- |
| Trigger | `getAddress()` rejected with `User rejected` |
| Recovery primary | `Try again` → `S5` (re-fires `getAddress()`) |
| Recovery secondary | `Cancel` |
| Notes | Preserve any cached address from prior connect — but require fresh approval |

### Reject — signature (`E2`)

| Field | Value |
| :---- | :---- |
| Trigger | `signMessage()` rejected with `User rejected` |
| Recovery primary | `Try again` → `S8` (re-fires `signMessage()` with same nonce if not expired) |
| Recovery secondary | `Disconnect wallet` (releases connection state, closes modal) |
| Notes | If the original nonce expired between rejection and retry, fetch a fresh one and replay `S7` for verification |

### Timeout (`E3`)

| Field | Value |
| :---- | :---- |
| Trigger | 60 s elapsed in `S5` or `S8` with no extension response |
| Recovery primary | `Retry` → returns to whichever state timed out |
| Recovery secondary | `Cancel` |
| Notes | Do not increase timeout on retry. If the second `Retry` also times out, escalate to `E4`. |

### Extension error (`E4`)

| Field | Value |
| :---- | :---- |
| Trigger | Any unrecognized exception from the Freighter API; `chrome-extension` URL invalidated |
| Recovery primary | `Reload page` (preserves `?next=`) |
| Recovery secondary | `Cancel` |
| Below-body | Collapsible `Show details` revealing the raw error message for support tickets |

### Server error — verify (`E5`)

| Field | Value |
| :---- | :---- |
| Trigger | `/api/auth/verify` returned non-2xx |
| Cause: Network | `Try again` repeats the verify call. If 3 consecutive network failures, switch primary action to `Contact support`. |
| Cause: Server | Same as Network. Different copy ("Something went wrong on our side."). |
| Cause: Expired nonce | `Try again` restarts at `S7` with a fresh challenge from the server. The user must re-sign — we cannot reuse the now-invalid signature. |

---

## State-Crossing Recovery: Full Reset

A `Full reset` discards all transient state and returns to `S1`. It runs when:

* The user closes the modal (× / `Cancel`) and reopens it.
* `E4` recovery (`Reload page`) completes.
* The Freighter network-change event fires while we are in `S5`–`S9` (defensive — the
  network we approved against may differ from the one we're about to sign with).

Full reset never preserves cached extension state on our side; the next iteration
re-detects from scratch.

---

## Help Surfaces

Some failures cannot be resolved inside the modal. The flow has three deliberate help
surfaces, never more.

| Surface | Trigger | Destination |
| :------ | :------ | :---------- |
| `Need help?` link | 30 s in `S2` / `S3` / `S6` with no progress | Article on installing / unlocking / network-switching Freighter |
| `Show details` collapse | `E4` body | Reveals raw error message, in-place |
| `Contact support` | `E5` after 3 retries | Help/contact page with the request id pre-filled |

The flow does not link out to a "wallet help center" homepage. Vague help links erode
trust; deep links to the specific topic the user is stuck on do not.

---

## Logging & Telemetry (design-side)

The design relies on the data layer to log specific events so we can refine recovery copy
over time. The events the design assumes are:

| Event | When |
| :---- | :--- |
| `wallet_modal_opened` | Modal entered `S1` |
| `wallet_state_<id>` | Each state entered |
| `wallet_recovery_clicked` (with state) | Primary action of an `E*` state clicked |
| `wallet_modal_closed` (with last state) | Modal closed without success |
| `wallet_connected` (with truncated address) | Reached `S10` |

These are events the **UX** depends on — instrumenting them is out of scope for this PR but
must accompany the implementation that follows.

---

## QA Checklist for Errors

- [ ] Every cause in the taxonomy has exactly one matching state.
- [ ] No error state has more than two footer buttons.
- [ ] No state silently retries; every retry is user-initiated.
- [ ] `S6` has no "continue anyway" path.
- [ ] `E5` switches to `Contact support` after 3 consecutive retries.
- [ ] `E4` reload preserves the `?next=` entry-point pointer.
- [ ] Re-detect polling stops within 100 ms of the modal closing.
- [ ] All help-surface links go to topic-specific articles, not a wallet help homepage.
