# Dashboard Overview — Accessibility & QA Basics

This document is the **accessibility QA list** for the Dashboard Overview redesign. It is a
checkable distillation of the rules already captured in
[`docs/accessibility-dense-ui.md`](../../docs/accessibility-dense-ui.md) and the iconography
system, applied to the four bands of the overview.

The underlying principle: **a user who can't see color, can't hear motion, or can't see at
all should still be able to answer "how am I doing?"**.

---

## 1. Color & Contrast

- [ ] Every text/icon over `#0a0a0a` background meets **WCAG AA 4.5:1** for body, **3:1**
      for large text and graphical objects.
- [ ] Chart series colors meet **3:1** against the background and against any series they
      can overlap with.
- [ ] No state (success / warning / error) is conveyed by color alone — every state has an
      icon and a text label.
- [ ] Focus rings are visible on dark backgrounds (`2px solid #0ff0fc` outline + 2 px offset),
      not the browser default.

---

## 2. Number, Unit & Abbreviation Handling

(See [`docs/accessibility-dense-ui.md` §2 and §3](../../docs/accessibility-dense-ui.md).)

- [ ] Compact notation (`1.2M`, `342K`) is paired with an `aria-label` containing the full
      number and unit (e.g., `1.2 million dollars`).
- [ ] Project-specific abbreviations (`TVL`, `APY`, `XLM`) use `<abbr>` with a long-form
      `title`, **and** the KPI tile's `aria-label` expands them.
- [ ] Currency tiles announce the currency name, not the symbol (`$1,250` →
      `1,250 US dollars`).
- [ ] Deltas announce direction in words: `+12.5%` →
      `Increase of 12.5 percent vs last 30 days`.
- [ ] Drawdown and other "up-is-bad" metrics announce semantic direction
      (`Drawdown increased by 0.5 percent — warning`), not raw direction.

---

## 3. Headings & Landmarks

- [ ] The overview uses a single `<main>` landmark.
- [ ] Page heading (`<h1>`) is the greeting; band titles use `<h2>`; sub-block titles
      (e.g., distribution chart toggle group) use `<h3>`.
- [ ] No band is rendered without a heading, even when the heading is visually-hidden
      (`sr-only`).
- [ ] Reading order matches the visual order at every breakpoint — no `order:` CSS that
      reverses content for screen-reader users.

---

## 4. Keyboard Navigation

- [ ] Tab order: range selector → KPI tiles (left-to-right, top-to-bottom) → insights →
      trend chart (with arrow-key cursor) → distribution chart toggle → distribution bars.
- [ ] No tab trap; the user can escape every component (e.g., chart cursor) with `Esc`.
- [ ] All focusable elements have a visible focus state. Skip links to "Insights" and
      "Charts" are present at the top of `<main>`.
- [ ] Trend chart cursor is **arrow-key navigable**: Left/Right move the cursor; the focused
      data point announces label and value.
- [ ] Insight cards are reachable in 1 Tab from the band; primary action and dismiss are the
      next two stops in that order.
- [ ] Range selector segmented control supports Left/Right arrow navigation between buttons
      and announces the selected option.

---

## 5. Motion & Animation

- [ ] All shimmer / skeleton animations respect `prefers-reduced-motion: reduce`.
- [ ] All state-transition animations (skeleton → populated, error swap) respect
      `prefers-reduced-motion: reduce`.
- [ ] Chart mount animation is disabled under reduced motion (line draws instantly).
- [ ] No animation lasts longer than 400 ms; nothing on the overview animates indefinitely
      except the loading shimmer (which itself can be disabled).

---

## 6. Charts (Detail)

- [ ] Each chart is wrapped in `<figure>` with a `<figcaption>` summarizing the data in plain
      language ("Total committed value rose 5.2% over the last 30 days").
- [ ] A visually-hidden `<table>` mirrors the chart series (one row per data point) so screen
      readers can read the data without a custom plugin.
- [ ] Hover tooltips have a keyboard-accessible equivalent (arrow-key cursor).
- [ ] Chart legends are real text, not part of an SVG image — and their colored swatches use
      a shape variation (line, dashed, dotted) so they remain distinguishable in greyscale.

---

## 7. States

- [ ] Loading bands set `aria-busy="true"` and provide an `aria-label` describing what is
      loading.
- [ ] Skeleton blocks announce themselves as `role="status"` with `aria-label="Loading <band>"`.
- [ ] Error cards expose the cause clause as readable text, not as an icon-only treatment.
- [ ] Empty (onboarding) state has a primary CTA reachable in ≤ 2 Tabs from the page entry.
- [ ] `0` values render as `0` and are not announced as "no data".

---

## 8. Touch & Pointer

- [ ] Tap targets are ≥ 44 × 44 px on `xs`/`sm` viewports.
- [ ] Hover-only affordances (info tooltips on KPI labels) are also accessible by tap and
      via keyboard focus.
- [ ] No drag-only gestures: insights carousel uses scroll-snap, not custom drag handlers.

---

## 9. Copy

- [ ] Sentence case for labels and headings.
- [ ] No raw error messages or stack traces in the UI; error copy is human and resolves to
      one of the four cause clauses (Network / Permissions / Server / Timeout).
- [ ] Insight bodies do not exceed 140 characters.
- [ ] No metric-specific jargon without an `<abbr>` and an info tooltip.

---

## 10. Cross-Breakpoint QA

Run this list at **320 px**, **768 px**, and **1280 px** with both pointer and keyboard:

- [ ] No horizontal scroll on the page (charts may scroll horizontally inside their canvas).
- [ ] All four bands render their populated, empty, loading and error states.
- [ ] Skeleton heights match populated heights — no layout shift on resolve.
- [ ] Range selector + insight panel + trend chart stay in sync on selection change.
- [ ] Distribution chart category colors match the iconography system at every breakpoint.

---

## Tools

* **axe DevTools** for color contrast and ARIA violations.
* **VoiceOver / NVDA** smoke test on the populated and empty states.
* **Keyboard-only** walkthrough from page load to creating a commitment via the empty-state
  CTA.
* **`prefers-reduced-motion`** simulated via the OS or DevTools to confirm animations stop.

---

## When to escalate

If during QA any of the following are true, **block the design from shipping**:

* A KPI cannot be read by a screen reader without ambiguity (e.g., compact notation with no
  long-form `aria-label`).
* A chart has no text equivalent.
* A state change relies on color or motion alone.
* Tab order skips an interactive element or traps focus inside one.
* The empty (onboarding) state has no primary CTA reachable above the fold at 360 px width.
