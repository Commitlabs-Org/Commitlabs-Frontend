# Accessibility Statement

CommitLabs is committed to making its web application usable by as many people as
possible, including people who rely on assistive technologies.

This statement records the target we hold ourselves to, where we stand against
it today, the gaps we know about, and how to report problems. The per-area
accessibility notes elsewhere in `docs/accessibility/` describe *how* specific
flows are made accessible; this document is the single place that states the
overall posture.

## Conformance target

We target **WCAG 2.1 Level AA**.

"Partially conformant" is an honest description of where the app is today: large
portions have been deliberately audited and remediated (see [Current
posture](#current-posture)), while some areas have not yet been verified
end-to-end against every AA success criterion.

## Current posture

Accessibility work that is already in place and verifiable in the codebase:

- **Color contrast** — a dark-theme contrast audit against the AA thresholds
  (4.5:1 normal text, 3.0:1 large text / graphical objects), with the remediated
  tokens recorded in [`CONTRAST_AUDIT.md`](CONTRAST_AUDIT.md).
- **Keyboard operation & screen-reader semantics** — the multi-step create flow
  documents its keyboard controls, focus order, and ARIA labelling in
  [`CREATE_WIZARD_A11Y.md`](CREATE_WIZARD_A11Y.md).
- **Focus management in overlays** — modal/dialog flows use `role="dialog"`,
  `aria-modal="true"`, focus-on-open, focus trapping, and focus restoration on
  close (see [`../ROUTE_AUTH_GUARD.md`](../ROUTE_AUTH_GUARD.md) and
  [`../MODAL_SYSTEM.md`](../MODAL_SYSTEM.md)).
- **Marketplace comparison** — focus traps and accessible properties for the
  compare interface are documented in [`MARKETPLACE_A11Y.md`](MARKETPLACE_A11Y.md).
- **Reduced motion** — animations respect the user's
  `prefers-reduced-motion` preference, per [`REDUCED_MOTION.md`](REDUCED_MOTION.md).
- **Data-dense layouts** — sizing and layout rules that keep tables usable are
  captured in [`../accessibility-dense-ui.md`](../accessibility-dense-ui.md).
- **Verification** — interactive flows are exercised with Playwright end-to-end
  tests (`npm run test:e2e`).

## Known gaps

These are tracked as ordinary issues; this list is intentionally honest rather
than aspirational.

- No automated accessibility assertions (e.g. an `axe` pass) run in CI yet, so AA
  conformance is currently verified by manual audit and targeted e2e coverage
  rather than continuous automated checks.
- Conformance has been audited per-area (contrast, create wizard, marketplace
  compare, overlays) but not yet as a single end-to-end pass across every route.
- The light/alternate theme has not been put through the same documented contrast
  audit as the dark theme.

If you find a barrier that is not listed here, please report it (see below) so we
can add it to the list and track a fix.

## Reporting an accessibility problem

We welcome reports of accessibility barriers.

- **Preferred:** open an issue in the
  [CommitLabs-Frontend repository](https://github.com/Commitlabs-Org/Commitlabs-Frontend/issues)
  and describe the page/flow, the assistive technology and browser you were
  using, and what you expected to happen.
- For sensitive reports you would rather not file publicly, use the private
  channel described in [`SECURITY.md`](../../SECURITY.md).

We aim to acknowledge accessibility reports and triage them alongside other
issues.
