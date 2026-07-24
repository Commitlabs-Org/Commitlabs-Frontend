# StarField — Motion, Visibility & Performance

`src/components/landing-page/ui/StarField.tsx`

## What it does

Renders a decorative star-field background on the landing page (desktop only,
hidden below `md` breakpoint) with support for reduced-motion preference,
tab visibility detection, and mobile viewport optimization.

---

## Reduced-Motion Handling

### Detection

The component uses `window.matchMedia("(prefers-reduced-motion: reduce)")` to
detect the user's accessibility preference at mount time. It listens for
runtime changes via the media query listener, allowing instant updates if the
user toggles the setting in OS preferences without reloading the page.

### Behavior

**When `prefers-reduced-motion: reduce` is active:**
- The animation class (`motion-safe:animate-pulse`) is NOT applied to stars
- Stars render as a static snapshot — fully visible, no flicker or movement
- The static appearance maintains the visual design without animation overhead

**When `prefers-reduced-motion: no-preference` (default):**
- Animation class is applied, creating a gentle pulse via CSS `opacity` keyframe
- Only `opacity` animates — no layout recalculation per frame
- Animation runs on the compositor thread (zero layout thrash)

---

## Tab Visibility Optimization

When the tab becomes hidden (`document.visibilitychange` with `document.hidden = true`),
the animation loop pauses to save CPU/battery on inactive tabs.

When the tab becomes visible again:
- Animation resumes **only if `prefers-reduced-motion` is not active**
- If reduced-motion is enabled, stars remain static

This prevents unnecessary animation on invisible content while respecting
accessibility preferences.

---

## Mobile & Low-Power Viewport Optimization

On viewports narrower than 768px (mobile breakpoint):
- Star count is capped at 40 (down from 150 on desktop)
- Fewer DOM elements reduce paint and reflow cost
- Smaller set still creates a visually satisfying starfield effect

Desktop viewports render all available stars with no cap.

---

## Accessibility

### `aria-hidden="true"`

The field is purely decorative. Exposing 50+ anonymous `<div>` elements to the
accessibility tree would add noise and confuse screen-reader users. Setting
`aria-hidden="true"` on the root removes the entire subtree from the tree.

### `pointer-events-none`

Without this, the overlay could silently absorb click/touch events that should
reach interactive content underneath. The Tailwind class maps to
`pointer-events: none` in CSS, which is zero-cost at runtime.

---

## Render Cost

| Concern | Decision |
|---|---|
| Per-frame JS | None — pure CSS animation (when enabled) |
| Layout thrash | None — `opacity` only, compositor-friendly |
| DOM count | 40–150 static `<div>` elements; painted once, then composited |
| Reflow triggers | None at runtime |
| Star positions | Pre-computed percentage values; no dynamic calculation |
| Tab visibility | Animation paused entirely when tab is hidden |

---

## Event Listeners & Cleanup

The component manages these listeners:
1. **`prefers-reduced-motion` media query change** — detects OS setting updates
2. **`visibilitychange` on document** — pauses animation when tab is hidden

Both listeners are removed on component unmount to prevent memory leaks.

---

## Testing

`src/components/landing-page/__tests__/StarField.test.tsx` covers:

- Accessibility: `aria-hidden="true"`, `pointer-events-none`
- Reduced-motion: static fallback when `prefers-reduced-motion: reduce`
- Runtime media query change handling
- Tab visibility: animation pauses when hidden, resumes when visible
- Mobile optimization: star count capped on narrow viewports (< 768px)
- Listener cleanup on unmount (no leaks)
- SSR-safe rendering (no `window.matchMedia` call at render time)

---

## Performance Impact

- **Reduced-motion users**: zero animation overhead, pure static render
- **Default-motion, tab visible**: gentle CSS pulse on compositor thread
- **Default-motion, tab hidden**: zero animation overhead (paused)
- **Mobile**: fewer stars, lower paint/reflow cost
- **All users**: no JS timers, no layout thrash
