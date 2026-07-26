# Findings — Landing & Navigation

Flow code:
* [`src/app/page.tsx`](../../../src/app/page.tsx)
* [`src/app/layout.tsx`](../../../src/app/layout.tsx)
* [`src/components/landing-page/Navigation.tsx`](../../../src/components/landing-page/Navigation.tsx)
* [`src/components/landing-page/Footer.tsx`](../../../src/components/landing-page/Footer.tsx)
* [`src/components/landing-page/sections/`](../../../src/components/landing-page/sections/)

---

### F-01-01 — Hash-anchor links incorrectly marked `aria-current="page"`

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 4.1.2 (Name, Role, Value), 1.3.1 (Info and Relationships) |
| Location | [`Navigation.tsx:50`](../../../src/components/landing-page/Navigation.tsx) |

**Observation.** The `<a href="#features">` link in the primary navigation is hard-coded
with `aria-current="page"`. `#features` is a same-page anchor, not the current page.
`aria-current="page"` should mark the currently-active route only.

**User impact.** Screen-reader users hear "current page" announced on a link that takes
them to a section, not a page. When the user is actually on the Settings or Marketplace
route, the Features link still claims to be the current page, which is incorrect and
confusing.

**Recommended fix.** Remove `aria-current="page"` from the static markup. If we want to
indicate the section the user is currently viewing, use `aria-current="location"` driven
by an IntersectionObserver that watches the section ids — but this is a stretch goal, not
required for AA. Removing the incorrect attribute is sufficient.

**Verification.** Tab to each nav link with NVDA active; confirm none announce "current
page" while on `/`.

---

### F-01-02 — Mobile nav menu links remain in tab order when menu is closed

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 2.4.3 (Focus Order) |
| Location | [`Navigation.tsx:36–83`](../../../src/components/landing-page/Navigation.tsx) |

**Observation.** On viewports `≤ 900px`, the mobile menu is hidden via
`max-[900px]:opacity-0 max-[900px]:pointer-events-none max-[900px]:-translate-y-[10px]`.
None of those properties remove the links from the accessibility tree or the tab order.
A keyboard user on mobile can `Tab` through nav links that are not visible.

**User impact.** Keyboard / screen-reader users on mobile widths get phantom focus stops
on links they cannot see.

**Recommended fix.** When `menuOpen` is false on mobile, apply either `display: none`,
`visibility: hidden`, or `inert` to the nav element. `inert` is preferred because it both
removes from tab order and prevents AT interaction without affecting reflow. Pair with the
existing `aria-expanded` on the toggle button.

**Verification.** Resize to 360 px, do not open the menu, `Tab` from the logo: focus
should skip directly to "Get Started" / hamburger button without visiting Features / How
it works / Benefits / Settings.

---

### F-01-03 — Focus indicator relies on text-shadow glow

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 2.4.7 (Focus Visible), 1.4.11 (Non-text Contrast) |
| Location | [`Navigation.tsx:49,57,64,71`](../../../src/components/landing-page/Navigation.tsx) |

**Observation.** Nav links use `focus-visible:[text-shadow:0_0_12px_rgba(0,212,255,0.5)]`
as the only focus indicator. A glow text-shadow does not satisfy the 3:1 non-text
contrast requirement for focus indicators because shadow halos do not have a defined
contrast against arbitrary backgrounds.

**User impact.** Low-vision users may not perceive the focused link, especially on
backgrounds that desaturate or wash out the cyan glow.

**Recommended fix.** Add a real outline on focus: `outline: 2px solid #0ff0fc; outline-offset:
2px;` (or the equivalent Tailwind `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ff0fc]`).
Keep the text-shadow as a secondary delight; the outline is the AA carrier.

**Verification.** Tab to each nav link; outline must be visible at all four breakpoints
(360 / 768 / 1024 / 1280 px) without depending on the glow.

---

### F-01-04 — Mobile menu open does not move focus into the menu

| | |
| :---- | :---- |
| Severity | High |
| Effort | S |
| WCAG | 2.4.3 (Focus Order) |
| Location | [`Navigation.tsx:9–12`](../../../src/components/landing-page/Navigation.tsx) |

**Observation.** Clicking the hamburger toggles `menuOpen` but does not move focus into
the now-visible menu. Focus stays on the toggle button. A `Tab` press from the toggle
takes the user out of the menu region (to "Get Started" or the next page element) rather
than into it.

**User impact.** Keyboard users open the menu, see it visually, but their focus is
outside it; the next Tab confusingly leaves the menu instead of entering it.

**Recommended fix.** When `menuOpen` becomes true, move focus to the first nav link
(`Features`). When `menuOpen` becomes false (via `Esc` or a link click), return focus to
the toggle button. Add `Esc` handler at the document level while open.

**Verification.** On 360 px: open menu via keyboard, press `Tab` — focus should land on
"Features", not somewhere outside the menu.

---

### F-01-05 — Hash anchor targets are not focusable when navigated to

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 2.4.3 (Focus Order) |
| Location | landing-page section components ([`HeroSection`](../../../src/components/landing-page/sections/HeroSection.tsx), [`ProblemSection`](../../../src/components/landing-page/sections/ProblemSection.tsx), etc.) |

**Observation.** Nav links target `#features`, `#how-it-works`, `#benefits`. When the user
activates these links, the browser scrolls but does not move focus to the section because
section wrappers do not have `tabindex="-1"`. Subsequent `Tab` presses continue from
wherever focus was — usually back at the top of the document.

**User impact.** Keyboard users click "How it works", scroll lands them visually on the
section, but a `Tab` takes them back to the navigation. They have to scroll-tab to reach
the section's CTAs.

**Recommended fix.** Add `tabindex="-1"` to each section landing target (the element that
owns the matching id). On link activation, after scroll, the section receives focus and
subsequent Tab progresses through that section's content.

**Verification.** Activate each nav anchor with `Enter`; the next `Tab` should move focus
to the first interactive element inside the targeted section.

---

### F-01-06 — Skip link only targets `#main-content`

| | |
| :---- | :---- |
| Severity | Low |
| Effort | M |
| WCAG | 2.4.1 (Bypass Blocks) — informational; current implementation passes |
| Location | [`src/app/layout.tsx:77`](../../../src/app/layout.tsx), [`src/app/globals.css:77–91`](../../../src/app/globals.css) |

**Observation.** The site has a single skip link to `#main-content`. AA passes. On dense
pages (marketplace, dashboard) a second skip target — "Skip to results" or "Skip to
filters" — would let keyboard users avoid tabbing through repeated nav and filter chrome
on every page load.

**User impact.** None for AA; an ergonomic loss for power users.

**Recommended fix.** Forward-looking. On marketplace and commitments-list pages, render a
second skip link (`Skip to results`) targeting the results landmark. Keep the existing
`#main-content` link as primary.

**Verification.** Tab from page load on `/marketplace`: two skip links appear in
sequence; activating the second moves focus into the results region.

---

### F-01-07 — `<button aria-hidden="true">` wraps the logo glyph

| | |
| :---- | :---- |
| Severity | Medium |
| Effort | S |
| WCAG | 1.3.1 (Info and Relationships) |
| Location | [`Navigation.tsx:25–32`](../../../src/components/landing-page/Navigation.tsx) |

**Observation.** The "C" logo glyph is wrapped in `<span aria-hidden="true">…<span>` which
is fine — but the glyph and the brand text live inside the same `<Link>`. The link's
accessible name resolves to "CommitLabs", which is correct. Worth verifying after any
markup churn that the order doesn't introduce duplicate names.

**User impact.** None today; this is a regression-watch item for future refactors.

**Recommended fix.** Document the constraint in the navigation component spec: the link
must resolve to the single accessible name "CommitLabs". Add a unit assertion if/when a
test exists for this component.

**Verification.** Inspect with the Chrome accessibility tree — `<a>` has computed name
`CommitLabs`, no children contribute to it.

---

## Quick wins on this flow

| ID | Action | Effort |
| :- | :----- | :----- |
| F-01-01 | Drop `aria-current="page"` from hash-anchor link | S |
| F-01-03 | Replace text-shadow focus with real outline | S |
| F-01-02 | Add `inert` (or `display:none`) to closed mobile nav | S |
| F-01-04 | Move focus on menu open / restore on close | S |

If the team can only land one PR for the landing flow, it should bundle these four.
