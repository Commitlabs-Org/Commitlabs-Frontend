# Wallet Connection — Accessibility & QA

This document is the accessibility and edge-case QA checklist for the wallet connection
flow. It distills relevant rules from
[`docs/accessibility-dense-ui.md`](../../docs/accessibility-dense-ui.md) and applies them
to the modal-based flow defined in [`states.md`](./states.md) and
[`flow-diagram.md`](./flow-diagram.md).

The underlying principle: a user who can't see, can't hear, or can't see motion must still
be able to know **what they are signing and why** before they approve.

---

## 1. Modal Semantics

- [ ] The modal uses `role="dialog"` with `aria-modal="true"`.
- [ ] The modal has an accessible name via `aria-labelledby` pointing to the state header.
- [ ] The modal has an accessible description via `aria-describedby` pointing to the
      subhead (and the security strip when present).
- [ ] Opening the modal moves focus to the modal container; closing returns focus to the
      element that opened it.
- [ ] Focus is **trapped** inside the modal until it closes.
- [ ] `Esc` closes the modal in every state. The `×` button has an explicit `aria-label`
      of `Close wallet connection`.

---

## 2. Reading the Signature Aloud

The single most important a11y outcome is that a screen-reader user understands the
signature before approving.

- [ ] The `S7` body (signature preview) uses `<pre>` with `role="region"` and
      `aria-label="Message you'll sign"`.
- [ ] The labels below the preview are part of the same region and are announced after
      the preview, not before.
- [ ] The security strip has `aria-live="polite"` so it is re-announced on state changes
      where its copy changes.
- [ ] Truncated addresses include a visually-hidden full address: e.g.,
      `<span aria-hidden="true">G…X4Y5</span><span class="sr-only">Stellar account
      address GBQ7…X4Y5, ending X 4 Y 5</span>`.
- [ ] The "Connected as" address has `aria-label="Connected as Stellar account ending
      X 4 Y 5"` so the trailing characters are read individually.

---

## 3. State Transitions

- [ ] State changes update `aria-live="polite"` regions; nothing critical is silent.
- [ ] In-flight states (`S1`, `S5`, `S8`, `S9`) set `aria-busy="true"` on the modal body;
      this flips to `false` when the next state renders.
- [ ] Loading indicators (spinners, pulses) include a visually-hidden text label:
      `Detecting wallet`, `Waiting for Freighter approval`, `Waiting for signature`,
      `Verifying signature`.
- [ ] Auto-close from `S10` (1.5 s) is preceded by an announcement: `Connected. Closing.`
      so screen-reader users are not surprised by focus return.

---

## 4. Keyboard

- [ ] Tab order in every state: header `×` → primary action → secondary action.
- [ ] In `S2` and `S6`, the below-body link (`Already installed?` / `Need help?`) is
      reachable in tab order **after** the primary action.
- [ ] In `E4`, the `Show details` collapse is reachable; expanded details are read out by
      screen readers in document order.
- [ ] Pressing `Enter` on the primary action triggers the same handler as a click.
- [ ] No state requires hover to reveal critical information (timeouts, security copy,
      network names).

---

## 5. Color & Contrast

- [ ] Modal text over `#0a0a0a` background meets WCAG AA 4.5:1 for body, 3:1 for large
      text.
- [ ] Error states never use color alone — every error has an icon (alert-triangle / info)
      and text.
- [ ] The network mismatch state's red/green chips are paired with text labels (`Testnet`,
      `Mainnet`); a colorblind user can read the mismatch from the labels alone.
- [ ] Focus rings are visible on dark backgrounds (`2px solid #0ff0fc`, 2 px offset),
      not browser default.

---

## 6. Motion

- [ ] All animated indicators (pulses, arrow illustrations) respect
      `prefers-reduced-motion: reduce` — under reduced motion, indicators are static.
- [ ] State transitions do not animate under reduced motion; the state swap is instant.
- [ ] `S10` auto-close still respects the 1.5 s timer under reduced motion (the timer is
      not an animation).

---

## 7. Edge Cases

These are the cases that bite real users in real wallet flows. Each must have a designed
state.

- [ ] **Ad blockers / privacy extensions** that block the Freighter content script: the
      detection step (`S1`) times out and falls to `S2`. The `Need help?` article covers
      this case.
- [ ] **Multiple wallets installed** (Freighter + Albedo + xBull): the modal asks
      explicitly for Freighter and ignores other wallets. There is no "wallet picker" in
      this PR — adding one is a follow-up design.
- [ ] **Brave's "block scripts"** mode: same as ad blockers; falls to `S2`.
- [ ] **Mobile browsers without an extension model** (mobile Safari, mobile Chrome): the
      detection times out and `S2` shows; the install link goes to a "Freighter on mobile"
      help article rather than the desktop install page.
- [ ] **Iframe contexts** (e.g., embedded preview): Freighter blocks injection; we detect
      the iframe and show a dedicated message in `S2`: `Open this page in a new tab to
      connect Freighter.`
- [ ] **Multiple browser profiles**: Freighter is per-profile; the modal does not assume a
      session from one profile carries to another. A user who switches profiles starts at
      `S1` again.
- [ ] **Hardware wallets behind Freighter** (Ledger): signing can take noticeably longer.
      The 60 s timeout in `S8` accommodates this; copy in `S8` adds a hint:
      `Hardware wallet? Confirm on the device.` (rendered when Freighter reports a
      hardware-wallet account).
- [ ] **Account changed in Freighter** mid-flow (user switched account in the popup):
      detection fires the account-change event; we go to a full reset (`S1`).
- [ ] **System clock skew** that expires the nonce instantly: `E5` cause `Expired nonce`
      with the regenerate-and-replay flow handles this case; copy does not blame the
      user's clock.
- [ ] **Network drops mid-verify**: `E5` cause `Network`. Verify is idempotent given the
      same signature, so retry is safe.
- [ ] **Nonce already used** (e.g., user submitted twice): treated as `Expired nonce`,
      handled identically.

---

## 8. Tools

* **axe DevTools** for WCAG violations on each state.
* **VoiceOver / NVDA** smoke test through `S1 → S4 → S5 → S7 → S8 → S9 → S10`.
* **Keyboard-only walkthrough** through every error state's primary recovery action.
* **Throttled network** for verifying timeouts (`E3`) and slow `S9` rendering.
* **Two browsers**: Chrome with Freighter, Firefox without — the latter to catch mobile
  / no-extension fallback paths.

---

## 9. Sign-Off Criteria

The flow ships only when **all** of these are true. If any is false, block the design.

* [ ] All 15 states have Figma frames at `mobile (360 px)`, `tablet (768 px)`, and
      `desktop (1280 px)`.
* [ ] Every state has been walked end-to-end with a screen reader.
* [ ] No state can be reached where the user does not know what their next signature does.
* [ ] No state can be reached without a primary recovery action.
* [ ] `prefers-reduced-motion` disables every animation in this surface.
* [ ] Network mismatch has no "continue anyway" path.
* [ ] The signature preview in `S7` matches, byte-for-byte, the message the wallet will
      display.
* [ ] All copy passes the rules in [`security-copy.md`](./security-copy.md).
