# Dashboard Overview — System States

Every band on the dashboard ships **four** states: populated, empty, loading, and error.
This document defines each state at the page level, how the bands behave together, and the
copy + visual cues that make the states unambiguous.

---

## State Decision Tree

```
Has the user ever had data?
 ├─ No  → Empty (onboarding)         ← whole page treats as empty
 └─ Yes →
     Is the request in flight?
      ├─ Yes → Loading                ← skeletons per band
      └─ No  →
          Did the request fail?
           ├─ Yes → Error             ← per-band error, page chrome remains
           └─ No  →
               Was the result non-zero?
                ├─ Yes → Populated
                └─ No  → Populated with `0`s (NOT empty)
```

The single most-violated rule: **`0` is data**. A user with one settled commitment that
returned 0 fees is **populated**, not empty.

---

## 1. Empty (Onboarding)

Triggered when the user has *zero* commitments. This is the most-likely first-session state
and is treated as a deliberate design — not a fallback.

### Page composition

```
┌────────────────────────────────────────────────────────────┐
│  Welcome to CommitLabs                                     │
│  Create your first commitment to track value, compliance,  │
│  and fees in one place.                                    │
│                                                            │
│  [ Create commitment ]   [ Browse marketplace ]            │
├────────────────────────────────────────────────────────────┤
│  KPI strip — all tiles in `empty` state                    │
│  (label visible, value = "—", no delta, no context)        │
├────────────────────────────────────────────────────────────┤
│  Insights panel: single onboarding card                    │
│  Trend chart: empty illustration + "Your value over time   │
│  will appear here."                                        │
├────────────────────────────────────────────────────────────┤
│  Distribution chart: empty illustration + CTA              │
└────────────────────────────────────────────────────────────┘
```

### Rules

* The empty hero band sits **above** the KPI strip — it is the only band that exists only
  in this state.
* KPI tiles render as ghost tiles with the metric label still visible. This teaches the
  shape of the UI before the user has data.
* The two CTAs are mutually exclusive in priority: `Create commitment` is primary;
  `Browse marketplace` is the secondary outline.
* No insight cards are dismissable in this state.

### Copy

| Element | Copy |
| :------ | :--- |
| Headline | `Welcome to CommitLabs` |
| Subhead | `Create your first commitment to track value, compliance, and fees in one place.` |
| Primary CTA | `Create commitment` |
| Secondary CTA | `Browse marketplace` |
| Onboarding insight body | `New here? Start with a Safe Commitment to see how value, compliance, and fees flow into your overview.` |

---

## 2. Loading

Triggered when at least one band is fetching data and has no cached value. Bands load
**independently** — KPIs may resolve before charts.

### Per-band skeletons

| Band | Skeleton |
| :--- | :------- |
| KPI strip | Each tile renders the label + a 3-line skeleton stack mirroring value height + delta width |
| Insights panel | Three skeleton cards with the populated card's exact height |
| Trend chart | Dashed grid + animated horizontal baseline that traverses the canvas left-to-right |
| Distribution chart | Four ghost bars at 60% / 30% / 20% / 10% widths matching final bar height |

### Animation

* Shimmer animation, 2s cycle, `cubic-bezier(0.4, 0, 0.2, 1)` — matches the existing
  [`Skeleton`](../../src/components/Skeleton.tsx) convention.
* `prefers-reduced-motion: reduce` → static gradient, no shimmer, no traversal.
* All bands use the same animation phase so the page feels coherent rather than jittery.

### Behavior rules

* Skeletons **mirror final layout**. No layout shift when data resolves.
* Bands with cached values from a previous session render **populated** with a "stale data"
  affordance (small dot + tooltip "Refreshing…") instead of a skeleton — never replace data
  the user has already seen with a skeleton.
* If a band loads for >5 seconds, replace its skeleton with the **error** state and a Retry
  control. Long blank screens erode trust faster than honest errors.
* Range-selector and other controls remain interactive while skeletons render — users can
  re-scope before all bands finish.

### A11y

* Each skeleton block has `role="status"` + `aria-label="Loading <band>"`.
* `aria-busy="true"` is set on the parent of the loading band; it flips to `false` when the
  band resolves (success **or** error).

---

## 3. Error

Triggered when a band's fetch fails after retries are exhausted. Errors are **per-band** —
the rest of the dashboard remains operational.

### Per-band treatment

```
┌────────────────────────────────────────────────────────────┐
│ [⚠]  Couldn't load <band-label>                            │
│      <network|permissions|server> · last updated <time>    │
│                                  [ Retry ]   [ Details ]   │
└────────────────────────────────────────────────────────────┘
```

| Element | Required | Notes |
| :------ | :------- | :---- |
| Alert icon | Yes | From iconography system (`alert-triangle`, orange or red by severity) |
| Headline | Yes | `Couldn't load <band-label>` — never `Error 500` or stack traces |
| Cause clause | Yes | One of: `Network`, `Permissions`, `Server`, `Timeout` |
| Last-updated | When cached value exists | `last updated 2 minutes ago` |
| Retry | Yes | Refetches the band only; never the whole page |
| Details | Optional | Opens a side-panel with the request id for support |

### Rules

* If a cached value exists, render the **populated** tile + a small "stale" badge — do not
  swap a real number for an error message.
* Errors do not bubble to the page header. The header remains usable so the user can change
  the range, navigate away, or retry from the band.
* Retry has a 3-attempt internal limit with exponential backoff. After three failures, the
  Retry button changes to `Contact support` linking to the help surface.

### Copy by cause

| Cause | Body |
| :---- | :--- |
| Network | `Check your connection and try again.` |
| Permissions | `Your account doesn't have access to this metric. Contact your admin.` |
| Server | `Something went wrong on our side. Retrying usually fixes it.` |
| Timeout | `That took longer than expected — retry or shorten the range.` |

---

## 4. Populated

The default state. Specs for each band are in their respective documents — this section
captures only the **page-level** rules.

* All four bands render with real values.
* Range selector controls KPI deltas, insights and trend chart **simultaneously**. No band
  may lag behind the selector.
* Updated timestamp lives in the page header (`Updated 12:42 · Refresh`), not per band, so
  the user has a single source of freshness truth.
* "Stale" affordances appear only when data is older than `range × 0.05` (e.g., > 36 minutes
  for a 30-day range) — too noisy below that threshold.

---

## State Transitions

| From | To | Trigger | Animation |
| :--- | :- | :------ | :-------- |
| Loading | Populated | Fetch resolves | Skeleton fades to value (200ms cross-fade) |
| Loading | Error | Fetch fails | Skeleton swaps to error card (no fade) |
| Loading | Empty | Fetch resolves with no records | Skeleton swaps to empty illustration (250ms fade) |
| Populated | Loading (refetch) | Range selector change | Tile keeps current value, dims to 60% opacity, "Refreshing…" tooltip on hover |
| Error | Populated | Retry succeeds | Error card swaps for tile (no animation) |
| Empty | Populated | User creates first commitment | Whole page reflows; onboarding band collapses with a 400ms ease-out |

`prefers-reduced-motion: reduce` disables all transition animations — state swaps are
instant.

---

## Page-Level QA Checklist

- [ ] Every band renders all four states in Figma.
- [ ] Skeleton heights equal populated heights at all three breakpoints.
- [ ] No band silently renders `null`.
- [ ] `0` values render as `0`, not as empty/error.
- [ ] Errors are per-band; the page header stays operational.
- [ ] Cached values are preserved during refetch and tagged "stale" instead of replaced.
- [ ] Onboarding (empty) state has a clear primary CTA above the fold at 360 px width.
- [ ] All state changes respect `prefers-reduced-motion`.
- [ ] Retry button gracefully degrades to `Contact support` after three failures.
