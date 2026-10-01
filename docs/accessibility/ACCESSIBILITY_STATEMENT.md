# Accessibility Statement — CommitLabs

**Last updated:** 2026-07-27

This document describes CommitLabs's current accessibility posture, known gaps,
and planned improvements. It is intended as an honest snapshot — not a marketing
claim — of where the application stands against **WCAG 2.1 Level AA**.

---

## Current posture

The following are already in place and verifiable in the codebase:

- **Landmarks & skip links:** every page has a `<main id="main-content">` landmark
  and a site-wide skip link.
- **Keyboard navigation:** all interactive elements are reachable via Tab; focus
  order follows DOM order.
- **Focus management:**
  - Focus-on-open for all modal/dialog flows.
  - Focus trapping during modal use (Tab and Shift+Tab cycle within the dialog).
  - **Focus restoration on close:** when a modal closes, focus returns to the
    previously active element (typically the trigger button).
- **ARIA semantics:**
  - `role="dialog"` with `aria-modal="true"` and `aria-labelledby` on all modals.
  - `aria-expanded` / `aria-controls` on toggle buttons (e.g., mobile filter panel).
  - `aria-sort` on sortable table columns.
  - `aria-disabled` (not native `disabled`) on conditionally-available buttons so
    they remain in the tab order.
- **Non-color indicators:** status and state are never communicated by color alone;
  icons, text labels, or patterns accompany every color-coded signal.
- **Chart accessibility:** health metric charts include visually-hidden data tables
  and `<figure>` / `<figcaption>` wrappers for screen-reader access.
- **Body scroll lock:** modals lock body scroll while open and restore it on close.
- **Reduced motion:** animations are wrapped in `motion-safe:` Tailwind variants
  so they are skipped when the user's OS requests reduced motion.

---

## Known gaps

The following issues are tracked and will be addressed in upcoming releases:

| ID      | Description                                                                                | Severity | Status |
| :------ | :----------------------------------------------------------------------------------------- | :------- | :----- |
| F-05-02 | Modal animations not gated on `prefers-reduced-motion` in some legacy modals               | High     | Open   |
| F-05-03 | No shared `<Dialog>` primitive — each modal re-implements focus trap / ARIA / scroll lock  | High     | Open   |
| F-05-04 | Early-exit modal needs explicit acknowledgement semantics for destructive actions          | High     | Open   |
| F-05-05 | Backdrop element missing `aria-hidden="true"` for screen-reader rotors                     | Medium   | Open   |
| F-05-06 | Modal close button accessible name is generic ("Close modal") instead of contextual        | Medium   | Open   |
| F-05-08 | Body scroll lock can leak if a second modal opens and closes while the first is still open | Medium   | Open   |

These are documented in detail in
[`design/accessibility-audit/findings/05-modals.md`](../../design/accessibility-audit/findings/05-modals.md).

---

## Testing

Accessibility is verified through:

1. **Keyboard testing** — every flow is operable via keyboard alone.
2. **Screen-reader testing** — VoiceOver (macOS) and NVDA (Windows).
3. **axe DevTools** — automated scan on every page (CI gate).
4. **Manual audit** — the full audit in [`design/accessibility-audit/`](../../design/accessibility-audit/)
   covers WCAG 2.1 AA across all five core flows.

---

## Feedback

If you encounter an accessibility barrier, please open an issue at
https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues with the label
`accessibility`.
