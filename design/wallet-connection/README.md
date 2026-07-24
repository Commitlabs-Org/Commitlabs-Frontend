# Wallet Connection & Signing — UI/UX Design

## Purpose

This module defines the **wallet connection and message-signing UX** for CommitLabs against
the Freighter Stellar wallet. It covers every state a user can land in between *"I clicked
Connect"* and *"I'm signed in"*, and the security copy that explains, in plain language,
**what** is being signed and **why**.

The goal is to ship a flow where:

* A user always knows *what their signature authorizes*.
* Every failure has a recovery path with one obvious next step.
* The same modal handles "first-time installer", "returning user", and "wrong network" with
  state changes — not separate flows that drift apart over time.
* Security copy is honest, short, and never technical-jargon for jargon's sake.

---

## Scope

This deliverable covers:

* The **Connect Wallet** modal and all of its states.
* The **Sign Message** modal that runs immediately after connection (the auth challenge
  defined in [`docs/session-implementation.md`](../../docs/session-implementation.md)).
* The six explicit states called out in the issue:
  1. **Not installed** — Freighter is not detected in the browser.
  2. **Connect** — extension is present; user must approve account sharing.
  3. **Sign challenge** — extension is connected; user must sign the auth nonce.
  4. **Reject** — user denied connection or signature in the extension.
  5. **Locked wallet** — Freighter is installed but locked.
  6. **Network mismatch** — Freighter is on a different Stellar network than the app.

Out of scope: post-auth in-app transaction signing for individual commitments (handled by
the Commitment Detail flow), wallet management settings, or any non-Freighter wallet. The
flow is structured so a second wallet provider can be added later as a list item, but
this PR documents Freighter only.

---

## What's Included

| File | What it defines |
| :--- | :-------------- |
| [`README.md`](./README.md) | Overview, principles, scope (this file) |
| [`flow-diagram.md`](./flow-diagram.md) | Entry points, state machine, modal step rules |
| [`states.md`](./states.md) | Per-state visual & content specs for all 6 states + connected/pending |
| [`security-copy.md`](./security-copy.md) | "What is being signed and why" — copy bank, do/don't list |
| [`errors-and-recovery.md`](./errors-and-recovery.md) | Error taxonomy, recovery actions, fallback paths |
| [`accessibility.md`](./accessibility.md) | A11y QA checklist for the modal flow |
| [`screens/`](./screens/) | High-fidelity comps (Figma exports) per state |

---

## Design Principles

1. **Explain the signature, every time.** No "Sign to continue" nonsense. The modal names
   the message that will be signed and the *purpose* of signing it (authentication, not
   transaction authorization).
2. **Wallet UI is not our UI.** When focus moves to the Freighter extension popup, our
   modal pauses with a clear "Check your Freighter extension" state. We never claim to know
   what the extension is showing.
3. **Failures are designed, not exceptions.** Reject, locked, network mismatch, timeout,
   and "extension crashed" each have a state with copy and a single primary recovery
   action.
4. **One modal, multiple states.** A user who installs Freighter mid-flow continues in the
   same modal — no second modal, no page reload. The state machine handles the transition.
5. **Security copy is short and honest.** No "this is 100% safe" claims. Tell the user what
   the signature can and **cannot** do (it cannot move funds; it proves wallet ownership).
6. **No silent retries.** Every retry is user-initiated. We do not invisibly re-request a
   signature after a reject — that trains users to click Approve out of habit.
7. **Network mismatch is a hard stop, not a warning.** We never proceed against the wrong
   network. The user must switch in Freighter; we cannot do it for them.

---

## State Map (high level)

```
                    ┌────────────────┐
                    │  CTA clicked   │
                    └───────┬────────┘
                            │
                ┌───────────▼───────────┐
                │  Detect Freighter     │
                └─────┬──────────┬──────┘
              missing │          │ present
                      │          │
                      ▼          ▼
            ┌──────────────┐  ┌────────────────┐
            │ Not installed│  │ Connect prompt │
            └──────┬───────┘  └────┬───────────┘
       Install →   │               │  Approve in extension
                   ▼               ▼
            ┌──────────────┐  ┌────────────────┐
            │ Re-detecting │  │  Signing prompt│
            └──────────────┘  └────┬───────────┘
                                   │
            ┌──────────────────────┼─────────────────────┐
            │                      │                     │
            ▼                      ▼                     ▼
   ┌─────────────┐        ┌────────────────┐    ┌────────────────┐
   │   Locked    │        │   Rejected     │    │  Network mismatch │
   └─────┬───────┘        └────────┬───────┘    └────────┬─────────┘
   Unlock│                Try again│             Switch network│
         │                         │                          │
         └───────────┬─────────────┴──────────────────────────┘
                     ▼
              ┌──────────────┐
              │   Connected  │
              │  + signed in │
              └──────────────┘
```

The full machine — including timeouts, the "extension crashed" terminal state, and
post-success transitions — lives in [`flow-diagram.md`](./flow-diagram.md).

---

## Reference Design

* Figma: see [`screens/README.md`](./screens/README.md) for the link and required exports.
* Session signing contract: [`docs/session-implementation.md`](../../docs/session-implementation.md).
* Tone & error treatment baseline: existing
  [`src/app/transaction-error/page.tsx`](../../src/app/transaction-error/page.tsx) and the
  [`design/iconography/`](../iconography/) status palette.

---

## Cross-References

* Iconography & status system (alert / locked / network icons): [`design/iconography/README.md`](../iconography/README.md)
* Skeleton loading patterns (used for the "Detecting wallet…" states): [`docs/skeleton-loading-patterns.md`](../../docs/skeleton-loading-patterns.md)
* Backend signing contract (challenge + verify): [`docs/session-implementation.md`](../../docs/session-implementation.md)
* Backend security checklist (reminds devs not to assume Freighter is installed): [`docs/backend-security-checklist.md`](../../docs/backend-security-checklist.md)
* Soroban util scaffold (the placeholder these designs will eventually drive): [`src/utils/soroban.ts`](../../src/utils/soroban.ts)

---

## Notes

* This is a **UI/UX-only** deliverable. No component code is added or changed by this PR.
* Comps must include the **dark theme** variant only — CommitLabs has no light theme today.
* Where copy uses placeholders (e.g., `<network>`, `<address>`), the placeholders are the
  same identifiers the data layer is expected to interpolate. See
  [`security-copy.md`](./security-copy.md) for the full list.
