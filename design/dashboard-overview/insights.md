# Dashboard Overview — Insights Panel

The insights panel turns the KPI strip's numbers into **short prose explanations** the user
can read in seconds. It sits beside the trend chart on desktop and below the KPI strip on
mobile.

---

## Why a panel and not more KPIs

KPI tiles answer *"what is the number?"*. Users still need help with *"is that good, and
should I do anything?"* — the gap that drives most "stare at the dashboard, leave confused"
sessions. Insights fill it.

Hard limits keep the panel honest:

* **Max 3 insights visible** at any time. Beyond three, users skim and ignore all of them.
* **One sentence each.** No paragraphs, no nested lists, no charts inside an insight.
* **Always tied to a KPI or chart on the same screen.** No insight may reference a metric the
  user cannot also see.

---

## Anatomy of an Insight Card

```
┌────────────────────────────────────────────────────┐
│ [icon]  Compliance up 3.1% this week               │
│         Driven by 2 commitments returning to       │
│         100% after the Apr 12 attestation cycle.   │
│                                                    │
│         [View commitments →]      [Dismiss]        │
└────────────────────────────────────────────────────┘
```

| Element | Required | Notes |
| :------ | :------- | :---- |
| Severity icon | Yes | One of: `positive`, `attention`, `risk`, `info`. From iconography system. |
| Headline | Yes | ≤ 60 chars, sentence case, contains a number when possible |
| Body | Yes | One sentence, ≤ 140 chars. Names the cause, not the effect. |
| Primary action | Optional | One link/button. Deep-links to the related view. Never opens a modal. |
| Dismiss | Yes (for non-critical) | Per-user, persists for the chosen severity for 7 days |

### Severity ↔ Treatment

| Severity | When to use | Icon | Accent | Dismissable? |
| :------- | :---------- | :--- | :----- | :----------- |
| `positive` | A KPI improved past a threshold (e.g., compliance ≥ 95%) | check-circle | green | yes |
| `attention` | A KPI moved in the wrong direction but not yet critical | info | teal | yes |
| `risk` | A commitment is at-risk or breached | alert-triangle | orange | **no** |
| `info` | Informational nudge unrelated to a KPI movement | info | neutral | yes |

`risk` insights are not dismissable because they map to user obligations (e.g., a commitment
about to violate). They are removed only when the underlying condition clears.

---

## Generation Rules (design-side)

This document does not specify the data pipeline; it specifies what the **UX contract** with
that pipeline must enforce.

1. **One source per insight.** An insight references exactly one KPI or chart series. If two
   would naturally combine, pick the one with the larger absolute change.
2. **Threshold-based, not noise-based.** Insights surface only when a metric crosses a
   configured threshold (e.g., compliance ±2%, drawdown > 1.5%). Day-to-day jitter does not.
3. **Period-locked to the dashboard range selector.** Switching the range filter regenerates
   the insights — they cannot reference a window the user is not currently viewing.
4. **Stable ordering.** Severity first (`risk` → `attention` → `positive` → `info`), then
   most-recent threshold-cross first within a severity.
5. **Never invent context.** If only the percent change is known, the body says
   *"Compliance up 3.1% this week"* — not a fabricated cause. The body's "driven by …"
   clause is omitted unless the cause is known.

---

## Empty, Loading, Error

| State | Trigger | Treatment |
| :---- | :------ | :-------- |
| Empty (no insights) | No threshold crossed in the period | Single neutral card: *"No notable changes in the last \<period\>. Your commitments are tracking as expected."* with `info` icon, no action |
| Empty (new account) | User has no data yet | Onboarding card: *"Create your first commitment to start seeing insights here."* with primary `Create commitment` action |
| Loading | Fetch in flight | Three skeleton cards matching the populated heights to prevent layout shift |
| Error | Fetch failed | Single error card: alert icon + *"Couldn't load insights"* + `Retry` action. KPIs and charts may still render normally. |

The panel never disappears. Even when there's nothing to say, the empty card holds the slot
so the page layout is stable across visits.

---

## Layout

### Desktop (≥ 1024 px)

The insights panel and the trend chart share row 3 of the overview as a **2-column band**:

```
┌─────────── Insights (40%) ─────────┐ ┌─────────── Trend chart (60%) ─────────┐
│  [risk]    Drawdown above 2%       │ │                                       │
│  [info]    Compliance up 3.1%      │ │             chart canvas              │
│  [info]    No notable changes…     │ │                                       │
└────────────────────────────────────┘ └───────────────────────────────────────┘
```

* Insight cards stack vertically.
* Card width is `100%` of the column.
* Vertical gap between cards: `0.75rem`.

### Tablet (640–1023 px)

Insights move **above** the trend chart, full-width. Card width remains 100%; gap unchanged.

### Mobile (< 640 px)

* Insights render as a **horizontal carousel** (snap-scroll, one card visible at a time, peek
  of next card on the right edge).
* Pagination dots below the carousel.
* `risk` cards always anchor to position 1 and cannot be scrolled past until acknowledged
  (tap the action) — they are the only insight that breaks ordering for visibility.

---

## Interaction

* **Hover** (desktop): card border brightens, action becomes underlined.
* **Click on body** (anywhere outside action / dismiss): same destination as the primary action.
* **Dismiss**: card animates out (250ms ease-out), the next queued insight slides up. Dismiss
  is reversible from the dashboard's "Insights settings" sheet (out of scope here, but design
  must accommodate the affordance).
* **Keyboard**: Tab order is severity-first. The action button is reachable in one Tab from
  the card root; Dismiss is the next Tab stop. Enter activates whichever has focus.

---

## Copy Bank (starter set)

These are the seed templates the data layer fills in. Designers iterate on tone here, not
in code.

| Severity | Template |
| :------- | :------- |
| positive | `Compliance up {pct}% {period}.` |
| positive | `{count} commitments completed {period}, generating {fees}.` |
| attention | `Drawdown {pct}% — within limits but trending up.` |
| attention | `Compliance down {pct}% {period}, watch {commitment}.` |
| risk | `Drawdown above {threshold}% on {commitment} — action required.` |
| risk | `{commitment} at risk of violation in {days} days.` |
| info | `New rule: max-loss threshold updated to {threshold}%.` |
| info | `No notable changes {period}.` |

Bodies follow the same template style and **always** name a cause if known, never a generic
restatement of the headline.

---

## QA Checklist for Insights

- [ ] At most three insights render at any breakpoint.
- [ ] Every insight references a metric visible on the same screen.
- [ ] `risk` insights cannot be dismissed; all others can.
- [ ] Empty / loading / error variants are designed and shipped to Figma.
- [ ] Severity order (`risk` → `attention` → `positive` → `info`) holds in all states.
- [ ] Mobile carousel snaps correctly and shows pagination dots.
- [ ] Insight body fits one line at desktop ≥ 1024 px and wraps to ≤ 2 lines at 360 px.
