# Findings — Marketplace

Flow code:
* [`src/app/marketplace/page.tsx`](../../../src/app/marketplace/page.tsx)
* [`src/components/MarketplaceHeader/`](../../../src/components/MarketplaceHeader/)
* [`src/components/MarketplaceFilter/`](../../../src/components/MarketplaceFilter/)
* [`src/components/MarketplaceGrid.tsx`](../../../src/components/MarketplaceGrid.tsx)
* [`src/components/MarketplaceCard.tsx`](../../../src/components/MarketplaceCard.tsx)

---

### F-03-01 — Mobile filter toggle exposes no state to assistive tech

| | |
| :---- | :---- |
| Severity | **Critical** |
| Effort | S |
| WCAG | 4.1.2 (Name, Role, Value) |
| Location | [`src/app/marketplace/page.tsx:438–444`](../../../src/app/marketplace/page.tsx) |

**Observation.** The mobile-only `Show Filters` / `Hide Filters` button switches its
visible label but exposes no `aria-expanded` and no `aria-controls`. The controlled
region (the `<aside>` filters) has no id. Screen-reader users hear a label change but
have no way to learn the button's role as a disclosure or its current state.

**User impact.** Mobile screen-reader users cannot tell the button is a disclosure, and
when they activate it they don't know what region appeared. They have to scroll-tab to
discover the filters showed up below.

**Recommended fix.**
* Give the `<aside>` filters element a stable id (`id="marketplace-filters"`).
* On the toggle button, add `aria-expanded={showMobileFilters}` and
  `aria-controls="marketplace-filters"`.
* Keep the visible "Show Filters" / "Hide Filters" label — they reinforce each other.

**Verification.** Activate the toggle with VoiceOver on iOS Safari at 360 px; the rotor
should announce "Show Filters, button, collapsed" → "Hide Filters, button, expanded".

---

### F-03-02 — Filter result count change is silent

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 4.1.3 (Status Messages) |
| Location | Filter UI + results region in [`src/app/marketplace/page.tsx`](../../../src/app/marketplace/page.tsx) |

**Observation.** When the user changes filters, the cards grid rerenders with a new
count. There is no `aria-live` announcement of "showing 12 results" or similar. Sighted
users see the count update; screen-reader users get no signal.

**User impact.** Screen-reader users do not know whether their filter selection narrowed
or widened the result set, or whether anything happened at all.

**Recommended fix.** Add an `aria-live="polite"` region above (or near the top of) the
results that updates with `Showing <n> of <total> commitments` after each filter change.
Debounce by ~250 ms so rapid filter changes do not produce a chatter of announcements.

**Verification.** With NVDA on, change a filter; the new count is announced once within
1 second.

---

### F-03-03 — Filters region lacks a heading / label

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`src/app/marketplace/page.tsx:449–458`](../../../src/app/marketplace/page.tsx), [`MarketplaceFilters`](../../../src/components/MarketplaceFilter/) |

**Observation.** The `<aside>` wrapping the filters has no `aria-label` or `aria-labelledby`
and no heading inside it. Screen-reader users entering the aside hear "complementary,
landmark" with no further name.

**User impact.** Multiple unnamed landmarks are hard to navigate. A user trying to jump
to filters via the rotor sees a generic "complementary".

**Recommended fix.** Add `aria-label="Filters"` to the `<aside>`, or include a visible
`<h2>Filters</h2>` and use `aria-labelledby` referencing it.

**Verification.** Open the rotor in VoiceOver; the filters region appears as
"Filters, landmark".

---

### F-03-04 — Pagination is not exposed as a navigation landmark

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships), 4.1.2 (Name, Role, Value) |
| Location | pagination block in [`src/app/marketplace/page.tsx`](../../../src/app/marketplace/page.tsx) |

**Observation.** The pagination control is rendered as buttons without a containing
`<nav aria-label="Pagination">` and no `aria-current="page"` on the active page button.

**User impact.** Screen-reader users cannot identify where in the page the pagination
lives or which page is current. They must read each button to find their place.

**Recommended fix.**
* Wrap the pagination controls in `<nav aria-label="Pagination">`.
* On the active page button, add `aria-current="page"`.
* Buttons get `aria-label="Page <n>"` (since "1" / "2" / "3" alone fail label-in-name
  heuristics).

**Verification.** Tab to pagination with NVDA; entering announces "Pagination, navigation
landmark"; the active page button announces "Page 2, current page".

---

### F-03-05 — Marketplace card whole-card click target is ambiguous

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | M |
| WCAG | 2.4.4 (Link Purpose), 4.1.2 (Name, Role, Value) |
| Location | [`MarketplaceCard.tsx`](../../../src/components/MarketplaceCard.tsx) |

**Observation.** Marketplace cards typically contain multiple actionable elements (View
Details, Save, the card body itself) inside a single clickable container. The accessible
name of the wrapping link/button can resolve to the entire card content, producing very
long names like "Safe Commitment 500 XLM 30 days 5.2 percent APY view details save".

**User impact.** Screen-reader users hear unwieldy names. Some users who navigate by
links struggle to compare options.

**Recommended fix.** Restructure each card to one primary clickable area whose accessible
name is concise (`Safe Commitment, 500 XLM, 30 days`). Secondary actions (Save,
Compare) live inside the card as separate buttons; activating them does not navigate.
Use `aria-describedby` to pull in supporting metadata (yield, count) as a description
rather than appending to the name. See [WAI link patterns](https://www.w3.org/WAI/ARIA/apg/patterns/link/).

**Verification.** With NVDA: tabbing through marketplace lands a single focus per card
with name "<type>, <amount>, <duration>"; the description includes yield and APY.

---

### F-03-06 — Search input may lack a programmatic label

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships), 3.3.2 (Labels or Instructions) |
| Location | [`MarketplaceHeader`](../../../src/components/MarketplaceHeader/) (`MarketplaceHeader.tsx`) |

**Observation.** The search input's accessible name comes from a placeholder by default.
Placeholders disappear when the user types and are not a substitute for a label per WCAG.
This needs verification in `MarketplaceHeader.tsx`; if the input has an `aria-label` or a
visible `<label>`, the finding is discharged.

**User impact.** Once a user starts typing, they may forget what the field was for; SR
users miss the field's purpose entirely if no label is present.

**Recommended fix.** Add a visible `<label>` (`Search`) or `aria-label="Search commitments"`
on the input. Keep the placeholder for example text only.

**Verification.** Tab to the search input; SR announces "Search commitments, edit text"
regardless of input value.

---

### F-03-07 — Active filter chips have no clear role / removal pattern

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | M |
| WCAG | 4.1.2 (Name, Role, Value), 2.1.1 (Keyboard) |
| Location | [`MarketplaceFilter/`](../../../src/components/MarketplaceFilter/) |

**Observation.** When filters are active, chips appear summarizing the current selection.
They typically include an "x" remove control. The audit needs to verify each chip has:
* Role of `button` (with an accessible name like `Remove "Safe" filter`).
* Keyboard activation via Enter and Space.
* Focus moves to the next chip (or back to the chip list heading) on removal.

**User impact.** Without these, keyboard users either cannot remove a filter or lose
focus when they do.

**Recommended fix.** Render each chip's remove control as a `<button>` with an
`aria-label="Remove <filter-name>"`. On click, remove the chip and move focus to the
next chip; if none remain, focus the filter region heading.

**Verification.** Apply two filters; tab to first chip's remove button, press Enter;
focus moves to the second chip and the announcement names the new state.

---

### F-03-08 — Empty / loading / error states (results region)

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 4.1.3 (Status Messages) |
| Location | results region in [`src/app/marketplace/page.tsx`](../../../src/app/marketplace/page.tsx), [`MarketplaceGridSkeleton`](../../../src/components/MarketplaceGridSkeleton.tsx) |

**Observation.** The skeleton already declares `aria-label="Loading marketplace listings"`
(verified in [`docs/skeleton-loading-patterns.md`](../../../docs/skeleton-loading-patterns.md)). Good. But the empty
("No commitments match your filters") and error states need parallel treatment so SR
users learn why their results are empty.

**User impact.** SR users may interpret "no results" as a loading delay rather than an
intentional empty state.

**Recommended fix.** Render empty / error messages with `role="status"` and
`aria-live="polite"`. Empty copy: `No commitments match your filters. Try removing
the <Type> or <Duration> filter.` — name the most-restrictive filter.

**Verification.** Apply a filter that produces zero results with NVDA on; announcement
fires with the empty copy.

---

## Summary

| ID | Severity | Effort |
| :- | :------- | :----- |
| F-03-01 | Critical | S |
| F-03-02 | High | S |
| F-03-04 | High | S |
| F-03-03 | Medium | S |
| F-03-05 | Medium | M |
| F-03-06 | Medium | S |
| F-03-07 | Medium | M |
| F-03-08 | Medium | S |

**Recommendation:** F-03-01 through F-03-04 are the high-leverage items (4 of 8 findings,
all S effort) and unlock the marketplace flow for SR/keyboard users.
