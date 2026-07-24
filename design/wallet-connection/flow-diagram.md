# Wallet Connection — Flow Diagrams & State Machine

This document defines the entry points into the wallet flow, the modal step structure, and
the full state machine. Per-state visual specs live in [`states.md`](./states.md);
per-error recovery actions live in [`errors-and-recovery.md`](./errors-and-recovery.md).

---

## Entry Points

The wallet flow is opened from any of these surfaces. They all converge on the same modal,
in the same starting state.

| Entry point | Location | CTA copy | Result on success |
| :---------- | :------- | :------- | :---------------- |
| Header "Connect wallet" | Top right of every page when signed-out | `Connect wallet` | Returns to current page, signed in |
| Empty-state CTA | Dashboard onboarding empty state | `Connect wallet to start` | Lands on dashboard populated state |
| Protected route gate | Any `/commitments`, `/create`, `/settings` route while unauthed | `Connect wallet to continue` | Resumes to the requested route |
| Session expired | After 24-hour JWT expiry while user is active | `Reconnect wallet` | Resumes the user's last route |

In all four cases, the post-success destination is held in URL state (`?next=`) and never
defaults to the home page silently.

---

## Modal Anatomy

Every state of the flow uses **the same modal frame**. Only the body and primary action
change between states. This is the single most important design decision in the flow:
a user who hits a network mismatch, switches networks, and retries should see the modal
update in place — not a new modal.

```
┌────────────────────────────────────────────────────────────┐
│  ◉ Connect wallet                                     [×]  │  Header
│  Sign in with your Freighter wallet                        │  Subhead (state-specific)
├────────────────────────────────────────────────────────────┤
│                                                            │
│              [ state-specific body content ]               │  Body
│                                                            │
├────────────────────────────────────────────────────────────┤
│  ⓘ What this signs: …                                       │  Security strip
├────────────────────────────────────────────────────────────┤
│   [ Cancel ]                       [ Primary action ]      │  Footer
└────────────────────────────────────────────────────────────┘
```

| Region | Allowed to change between states? | Notes |
| :----- | :-------------------------------- | :---- |
| Header title | Yes | But always names the **current step**, not the goal |
| Subhead | Yes | One sentence; sets context for body |
| Body | Yes | Largest area; visuals + copy per state |
| Security strip | Yes | Only visible during connect + sign states; hidden in success |
| Footer | Yes | Two buttons max. Primary action label changes per state. |
| Close (×) | Always present | Returns user to entry point with a toast: "Wallet not connected" |

The security strip is the small, persistent line that explains what a signature does. It
is **not** a tooltip; it is part of the modal layout. See [`security-copy.md`](./security-copy.md).

---

## State Machine

States are owned by the modal. Transitions are triggered either by **user actions** in our
modal, **events** from the Freighter API, or **timeouts** we enforce.

### States

| ID | Name | Type | Visible? |
| :- | :--- | :--- | :------- |
| `S0` | Idle (modal closed) | Terminal (start) | No |
| `S1` | Detecting | Loading | Yes |
| `S2` | Not installed | Recovery | Yes |
| `S3` | Locked | Recovery | Yes |
| `S4` | Connect prompt | Action required | Yes |
| `S5` | Awaiting connect approval | In-flight (extension) | Yes |
| `S6` | Network mismatch | Recovery | Yes |
| `S7` | Sign prompt | Action required | Yes |
| `S8` | Awaiting signature | In-flight (extension) | Yes |
| `S9` | Verifying | In-flight (server) | Yes |
| `S10` | Connected | Terminal (success) | Yes (1.5s, then closes) |
| `E1` | Rejected (connect) | Recovery | Yes |
| `E2` | Rejected (signature) | Recovery | Yes |
| `E3` | Timeout | Recovery | Yes |
| `E4` | Extension error | Recovery | Yes |
| `E5` | Server error (verify) | Recovery | Yes |

### Transitions

```
S0  ──open()──────────────────────────────►  S1

S1  ──detected────────────────────────────►  S4
S1  ──no-extension──────────────────────►   S2
S1  ──extension-locked──────────────────►   S3
S1  ──timeout (3s)─────────────────────►    S2  (with "Still not detecting?" hint)

S2  ──user-installed (re-detect tick)──►    S1
S3  ──user-unlocked (re-detect tick)───►    S1

S4  ──user clicks Connect──────────────►    S5
S5  ──extension approved───────────────►    [check network] ──match──► S7
                                                              ──mismatch──► S6
S5  ──extension rejected───────────────►    E1
S5  ──timeout (60s)─────────────────────►   E3
S5  ──extension threw──────────────────►    E4

S6  ──user switched in extension───────►    S1  (re-detect to confirm)

S7  ──user clicks Sign─────────────────►    S8
S8  ──extension signed─────────────────►    S9
S8  ──extension rejected───────────────►    E2
S8  ──timeout (60s)─────────────────────►   E3
S8  ──extension threw──────────────────►    E4

S9  ──server verified──────────────────►    S10
S9  ──server failed────────────────────►    E5

S10 ──auto-close (1.5s)────────────────►    S0  (now signed in)

E1  ──user clicks Try again────────────►    S5
E2  ──user clicks Try again────────────►    S8
E3  ──user clicks Retry────────────────►    S5 or S8 (whichever timed out)
E4  ──user clicks Reload extension─────►    closes modal, opens help
E5  ──user clicks Try again────────────►    S9
```

### Hard rules in the machine

* **No invisible retries.** A reject (`E1`/`E2`) does not auto-retry — the user must click
  `Try again`. This prevents trained-out muscle-memory approvals.
* **Timeouts are 60 seconds.** Long enough to find a hardware wallet; short enough to
  recover from a swallowed extension event.
* **Network mismatch (`S6`) blocks progress.** We do not present a "Continue anyway"
  affordance, even for testnet → mainnet drift.
* **Detecting (`S1`) caps at 3 seconds.** If the API does not respond by then, we move to
  `S2` ("Not installed") with a *"Still not detecting?"* hint, not a hung spinner.
* **`S10` auto-closes after 1.5 seconds.** Long enough to read "Connected", short enough to
  not feel like padding.

---

## Sub-Flow: Re-detect Loop

When the user is in `S2` (not installed) or `S3` (locked), the modal polls Freighter every
**1.5 seconds** so installing or unlocking the extension transitions the modal automatically
without requiring a click.

```
S2 / S3 ── tick (1.5s) ──► detect()
                            │
                ┌───────────┴───────────┐
                │                       │
        present + unlocked        still missing/locked
                │                       │
                ▼                       ▼
              S1 → …                  stay in S2 / S3
```

Polling stops when the modal closes or transitions out. After **30 seconds** of polling
with no change, we surface a small "Need help?" link below the body that opens the
[`errors-and-recovery.md`](./errors-and-recovery.md) help section.

---

## Sub-Flow: Network Mismatch

CommitLabs runs against either **Testnet** or **Mainnet** depending on env config (see
[`src/utils/soroban.ts`](../../src/utils/soroban.ts) `networkPassphrase`). After the user
approves connection in `S5`, we read the active network from Freighter:

* Match → continue to `S7`.
* Mismatch → `S6` with the explicit copy described in [`states.md`](./states.md).

When the user switches networks in Freighter, the extension fires a network-change event.
Our modal listens for it, returns to `S1`, and re-detects. We **never** ask the user to
manually retry after switching — the event is the trigger.

---

## Modal vs. Toasts vs. Pages

* **Modal**: every state in this flow.
* **Toast** (4-second snackbar): only after success-with-close, e.g.
  *"Connected as G…X4Y5"* on entry-point return. Toasts are not used for failures — failures
  stay in the modal where the recovery action is.
* **Full page**: never. Wallet connection is always modal-based; we do not navigate the user
  away from their entry point.

---

## Cancellation

Clicking the close (×), pressing `Esc`, or clicking the `Cancel` footer button always closes
the modal. The user returns to the entry point. A non-blocking toast confirms:

> Wallet not connected. You can reconnect anytime from the top right.

Cancellation **never** dismisses an in-flight extension popup. The Freighter popup is owned
by the extension; closing our modal does not close it. This is reflected in the `S5`/`S8`
copy ("Approve in your Freighter extension to continue").

---

## QA Checklist for the Flow

- [ ] All 15 states (`S1`–`S10`, `E1`–`E5`) have a Figma frame.
- [ ] State transitions match this document — no hidden auto-retries.
- [ ] Single modal frame is reused across states; no second modal opens during the flow.
- [ ] `Esc`, `×`, and `Cancel` close the modal in all states.
- [ ] Re-detect polling (1.5s) is implemented for `S2` and `S3`.
- [ ] Detection caps at 3 seconds, then falls to `S2`.
- [ ] Network mismatch is a hard stop with no "continue anyway" path.
- [ ] Success state auto-closes after 1.5 seconds and shows a return toast.
- [ ] Timeouts are 60 seconds for `S5` and `S8`.
