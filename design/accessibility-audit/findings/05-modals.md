# Findings — Modals

Flow code:
* [`src/components/modals/Commitmentcreatedmodal.tsx`](../../../src/components/modals/Commitmentcreatedmodal.tsx) (success)
* [`src/components/modals/CommitmentDetailsModal.tsx`](../../../src/components/modals/CommitmentDetailsModal.tsx)
* [`src/components/modals/CommitmentSuccess.tsx`](../../../src/components/modals/CommitmentSuccess.tsx)
* [`src/components/CommitmentEarlyExitModal/`](../../../src/components/CommitmentEarlyExitModal/)
* [`src/components/CommitmentCreatedModal .tsx`](../../../src/components/CommitmentCreatedModal%20.tsx) (note: file name has a trailing space)

The success modal does most things right; the issues below are about the **gaps that
repeat across each modal implementation** because there is no shared `Dialog` primitive.

---

### F-05-01 — Success modal does not restore focus to its trigger on close

| | |
| :---- | :---- |
| Severity | **Critical** |
| Effort | S (per modal) / L (introduce shared primitive) |
| WCAG | 2.4.3 (Focus Order) |
| Location | [`Commitmentcreatedmodal.tsx:30–50`](../../../src/components/modals/Commitmentcreatedmodal.tsx) |

**Observation.** The modal correctly moves focus to its primary button on open
(line 39–41) and traps focus during use (line 60–78). On close, the cleanup effect
restores `document.body.style.overflow` but does **not** call `.focus()` on the trigger
element. Focus falls to `<body>` and the keyboard user has to start their tab journey
from the page top.

**User impact.** Keyboard users who close a modal lose their place. After confirming a
commitment, they have to tab through the entire wizard chrome to return to the next
sensible action.

**Recommended fix.** Capture `document.activeElement` *before* the modal opens (when
`isOpen` flips false → true), store in a ref, and on close call `previousActiveElement.focus()`.
Same pattern applies to every modal. The right home for this is a shared `<Dialog>`
primitive — see [`component-spec-updates.md`](../component-spec-updates.md).

**Verification.** From `/create` step 3, submit, modal opens, close it via `Esc`; the
next focused element must be the original Submit button (or a sensible adjacent control,
e.g., the back link if Submit unmounts).

---

### F-05-02 — Modal animations not gated on `prefers-reduced-motion`

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 2.3.3 (Animation from Interactions, AAA — best practice) — also affects 1.4.13 |
| Location | [`Commitmentcreatedmodal.tsx:93,99,120`](../../../src/components/modals/Commitmentcreatedmodal.tsx) |

**Observation.** The modal uses `animate-in fade-in duration-200`,
`animate-in slide-in-from-bottom-4 duration-300`, and `animate-pulse-slow` (the success
icon). None are gated on `prefers-reduced-motion: reduce`. The success icon's
`animate-pulse-slow` runs **infinitely**.

**User impact.** Users with vestibular sensitivities receive motion they explicitly opted
out of via OS-level settings. The infinite pulse is the most aggressive case in the app.

**Recommended fix.** Wrap each animation utility in a `motion-safe:` variant
(`motion-safe:animate-in`, etc.) so the animations are skipped under reduced-motion.
Replace `animate-pulse-slow` on the success icon with a single 250 ms scale-in then a
static state — infinite animation is never the right choice for a success indicator.

**Verification.** Toggle `prefers-reduced-motion: reduce` in DevTools → Rendering;
re-trigger the modal. No animation runs.

---

### F-05-03 — Each modal re-implements the dialog pattern; behavior drifts

| | |
| :---- | :---- |
| Severity | High |
| Effort | L |
| WCAG | 2.4.3 (Focus Order), 4.1.2 (Name, Role, Value) — pattern issue, multiple criteria |
| Location | every file under [`src/components/modals/`](../../../src/components/modals/) and [`CommitmentEarlyExitModal/`](../../../src/components/CommitmentEarlyExitModal/) |

**Observation.** There are at least four modal implementations in the codebase
(success, details, success-toast, early-exit). Each implements its own focus trap,
escape handler, scroll lock, and ARIA wiring. They **already drift** — for example, the
success modal traps focus; the early-exit modal needs verification (separate finding
below). When patterns drift, fixes drift; one PR fixes the success modal but leaves the
others vulnerable.

**User impact.** Users get inconsistent behavior across modals — sometimes Esc closes,
sometimes not; sometimes focus traps, sometimes escapes.

**Recommended fix.** Introduce a `<Dialog>` primitive that owns the full pattern:
* `role="dialog"` with `aria-modal="true"` and required `aria-labelledby` (compile-time
  warning if missing).
* Focus capture on open, focus trap during, focus restore on close.
* `Esc` closes; click-outside closes (configurable).
* `prefers-reduced-motion`-gated animations.
* Body scroll lock that is reversible if multiple dialogs stack.

Migrate each modal to the primitive. This is the single highest-leverage refactor in the
audit — it discharges F-05-01, F-05-02, F-05-04 (next), and pre-empts the same class of
bugs in any new modal.

**Verification.** Each migrated modal must pass the same a11y checklist (focus restore,
Esc, animations, aria-labelledby) without per-modal exceptions.

---

### F-05-04 — Early-exit modal: confirmation pattern needs explicit acknowledgement semantics

| | |
| :---- | :---- |
| Severity | High |
| Effort | M |
| WCAG | 3.3.4 (Error Prevention, AA) |
| Location | [`CommitmentEarlyExitModal/`](../../../src/components/CommitmentEarlyExitModal/), invoked from [`src/app/commitments/page.tsx:251–259`](../../../src/app/commitments/page.tsx) |

**Observation.** The early-exit modal has a `hasAcknowledged` state passed in. This is
the right shape — destructive actions should require an explicit acknowledgement
checkbox before the confirm button activates. Two things to verify:

1. The acknowledgement checkbox has a programmatic label naming the consequence: `I
   understand that exiting early forfeits 5% of my commitment.`
2. The Confirm button is `aria-disabled` until `hasAcknowledged` is true (not native
   `disabled` — same issue as F-02-01).

**User impact.** Users (especially SR users) need to hear what they are acknowledging
before signing the action. WCAG 3.3.4 requires destructive actions on financial data to
be reversible, confirmed, or checked.

**Recommended fix.** Wire the checkbox label to the consequence text. Use `aria-disabled`
on the Confirm button and intercept clicks while not acknowledged. Add a visually-hidden
status text that announces "Confirmation required" so SR users hear *why* the button is
not yet active.

**Verification.** Open the modal, do not check the acknowledgement, tab to Confirm; SR
hears "Confirm, button, dimmed; confirmation required". Activating does nothing. Check
the box; SR hears "Confirmation acknowledged" (live region) and the button activates.

---

### F-05-05 — Backdrop interaction blocks AT users from leaving via gesture

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 2.4.3 (Focus Order), 1.3.1 (Info and Relationships) |
| Location | [`Commitmentcreatedmodal.tsx:92–96`](../../../src/components/modals/Commitmentcreatedmodal.tsx) |

**Observation.** The backdrop uses `role="presentation"` (line 95) and a click-outside
handler. Mouse users can dismiss by clicking the scrim. Keyboard / SR users cannot —
they can only Esc or use the close button. That's fine. But the scrim should also have
`aria-hidden="true"` so SR rotors do not list it as an unnamed region behind the dialog.

**User impact.** SR rotor lists a phantom region; mostly cosmetic.

**Recommended fix.** Add `aria-hidden="true"` to the backdrop element. Keep the
click-outside handler; a11y users still have Esc.

**Verification.** Open the modal with VoiceOver rotor open; only the dialog and its
contents appear in the regions list, not a separate scrim.

---

### F-05-06 — Modal close button accessible name

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 2.5.3 (Label in Name), 4.1.2 (Name, Role, Value) |
| Location | [`Commitmentcreatedmodal.tsx:110–116`](../../../src/components/modals/Commitmentcreatedmodal.tsx) |

**Observation.** The close button uses `aria-label="Close modal"`. The dialog itself has
a more specific name (`aria-labelledby="modal-title"`). The close button should reference
the same: `Close <modal name>` so the user hears `Close, Commitment created`.

**User impact.** Users with multiple modals across the app hear "Close modal" everywhere
with no differentiation. Voice control users (Dragon, Voice Control) cannot say
"Close commitment created" to dismiss.

**Recommended fix.** `aria-label="Close commitment created dialog"` (or whatever the
modal's title is). Or use the title id: `aria-labelledby="modal-close-prefix
modal-title"` with a hidden `Close` prefix.

**Verification.** With NVDA on the close button: announces "Close commitment created
dialog, button". With Voice Control: saying "Close commitment created" focuses and
activates the close button.

---

### F-05-07 — Multiple modals on same page: stacking and focus ownership

| | |
| :---- | :---- |
| Severity | Low |
| Effort | M |
| WCAG | 2.4.3 (Focus Order) |
| Location | pattern issue across [`src/components/modals/`](../../../src/components/modals/) |

**Observation.** Forward-looking: the codebase doesn't currently stack modals (open one
inside another), but the pattern would break the existing implementations. Each modal's
focus trap assumes single-instance.

**User impact.** None today. Tracked as a constraint to enforce in the new `<Dialog>`
primitive.

**Recommended fix.** When introducing the `<Dialog>` primitive (F-05-03), document and
enforce: only one dialog can be in `aria-modal="true"` state at a time; if a second
opens, the first is set to `inert` until the second closes; focus returns up the stack.

**Verification.** Pattern enforcement is a unit-test concern in the primitive; no
runtime check needed today.

---

### F-05-08 — Body scroll lock leaks if modal unmounts unexpectedly

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.4.10 (Reflow), 2.4.3 (Focus Order) — indirect |
| Location | [`Commitmentcreatedmodal.tsx:36,43`](../../../src/components/modals/Commitmentcreatedmodal.tsx) |

**Observation.** `document.body.style.overflow = 'hidden'` is set on open and reset on
close inside the same `useEffect`. If the modal unmounts unexpectedly (route change,
parent remount), the cleanup runs and overflow is restored — that's correct. But if a
second modal opens while this one is open, the second modal also writes `'hidden'` and
on close writes `'unset'`, accidentally re-enabling scroll while the first modal is
still open.

**User impact.** Edge case under stacking; today no real impact.

**Recommended fix.** Replace direct `document.body.style.overflow` writes with a counter
mechanism (`scroll-lock` library or a small in-house module) that only releases the lock
when the count hits zero. Belongs in the shared `<Dialog>` primitive.

**Verification.** Open two stacked dialogs, close the inner one; body remains scroll-locked.

---

## Summary

| ID | Severity | Effort |
| :- | :------- | :----- |
| F-05-01 | Critical | S (per modal) / L (primitive) |
| F-05-02 | High | S |
| F-05-03 | High | L |
| F-05-04 | High | M |
| F-05-05 | Medium | S |
| F-05-06 | Medium | S |
| F-05-08 | Medium | S |
| F-05-07 | Low | M |

**Recommendation:** if budget allows, do F-05-03 first — the `<Dialog>` primitive — and
let it discharge F-05-01, F-05-02, F-05-05, F-05-06, F-05-08 in one move. If not, fix
F-05-01 and F-05-02 on the success modal as a stop-gap; flag the others for the next
sprint.
